import { readFile, writeFile } from 'node:fs/promises';
import { isMissing } from './catalog';
import { renderCatalogModule } from './catalog-module';

/**
 * Three-way merge for the JSON files under `outDir`.
 *
 * Catalogs and translation state are committed, so two branches translating in
 * parallel will touch the same files. Git's line-based merge handles disjoint
 * key additions but conflicts on adjacent edits and produces conflict markers
 * inside JSON, which breaks every tool downstream. These mergers work on keys
 * instead, and are wired up as a git merge driver by `autotranslate init`.
 */

export type JsonRecord = Record<string, unknown>;

export type MergeKind = 'catalog' | 'state' | 'manifest' | 'module';

export interface MergeOutcome {
  readonly merged: JsonRecord;
  /** Keys where both sides changed the same entry. */
  readonly contested: ReadonlyArray<string>;
}

/**
 * Merge one catalog chunk, or the extraction manifest. Additions and deletions
 * from both sides are taken. When both sides changed the same key, `ours` wins -
 * and the state merge drops that key, so the next `translate` re-derives it from
 * the current source rather than leaving an arbitrary winner in place.
 */
export function mergeCatalog(base: JsonRecord, ours: JsonRecord, theirs: JsonRecord): MergeOutcome {
  return mergeRecords(base, ours, theirs, 'ours');
}

/**
 * Merge one translation-state chunk. A key both sides changed is DROPPED: the
 * two sides disagree about which source content the translation came from, and
 * the only safe answer is to retranslate. Omitting the key is exactly the
 * signal that makes the next run do that, for that key alone.
 */
export function mergeState(base: JsonRecord, ours: JsonRecord, theirs: JsonRecord): MergeOutcome {
  const version = (ours.version ?? theirs.version ?? base.version) as unknown;
  const outcome = mergeRecords(
    (base.keys ?? {}) as JsonRecord,
    (ours.keys ?? {}) as JsonRecord,
    (theirs.keys ?? {}) as JsonRecord,
    'drop',
  );
  return {
    merged: { version, keys: outcome.merged },
    contested: outcome.contested,
  };
}

function mergeRecords(
  base: JsonRecord,
  ours: JsonRecord,
  theirs: JsonRecord,
  onConflict: 'ours' | 'drop',
): MergeOutcome {
  const merged: JsonRecord = {};
  const contested: string[] = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)]);

  for (const key of [...keys].sort()) {
    const inBase = key in base;
    const inOurs = key in ours;
    const inTheirs = key in theirs;
    // A side "changed" the key if it added it, removed it, or edited it.
    const ourChanged = inOurs !== inBase || (inOurs && !same(base[key], ours[key]));
    const theirChanged = inTheirs !== inBase || (inTheirs && !same(base[key], theirs[key]));

    // Unchanged on one side: the other side's decision stands, including a
    // deletion (a key removed because its source string is gone).
    if (!ourChanged) {
      if (inTheirs) merged[key] = theirs[key];
      continue;
    }
    if (!theirChanged) {
      if (inOurs) merged[key] = ours[key];
      continue;
    }

    // Both sides moved. Agreeing on the outcome is not a conflict.
    if (!inOurs && !inTheirs) continue;
    if (inOurs && inTheirs && same(ours[key], theirs[key])) {
      merged[key] = ours[key];
      continue;
    }
    // A deletion racing an edit resolves to the deletion: the key is gone from
    // one side's source, and `extract` is the authority on which keys exist.
    if (!inOurs || !inTheirs) {
      contested.push(key);
      continue;
    }
    contested.push(key);
    if (onConflict === 'ours') merged[key] = ours[key];
  }

  return { merged, contested };
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merge the generated catalog module. Its content is a pure function of which
 * chunk files exist, so the correct merge is the union of both sides' chunk
 * lists - the same answer the catalog merge reaches for the JSON itself. Rather
 * than diffing text, both sides are parsed and the file is re-emitted.
 */
export function mergeCatalogModule(ours: string, theirs: string): string {
  const oursParsed = parseCatalogModule(ours);
  const theirsParsed = parseCatalogModule(theirs);
  if (!oursParsed) return theirs;
  if (!theirsParsed) return ours;

  const orderedLocales = [...oursParsed.locales];
  for (const locale of theirsParsed.locales) {
    if (!orderedLocales.includes(locale)) orderedLocales.push(locale);
  }

  const specifiers = new Map<string, ReadonlyArray<string>>();
  for (const locale of orderedLocales) {
    const union = new Set([
      ...(oursParsed.specifiers.get(locale) ?? []),
      ...(theirsParsed.specifiers.get(locale) ?? []),
    ]);
    if (union.size > 0) specifiers.set(locale, [...union].sort());
  }

  return renderCatalogModule(oursParsed.source, orderedLocales, specifiers);
}

interface ParsedCatalogModule {
  readonly source: string;
  readonly locales: ReadonlyArray<string>;
  readonly specifiers: ReadonlyMap<string, ReadonlyArray<string>>;
}

function parseCatalogModule(text: string): ParsedCatalogModule | undefined {
  const source = /export const source = '([^']+)' as const;/.exec(text)?.[1];
  const localesLine = /export const locales = \[([^\]]*)\] as const;/.exec(text)?.[1];
  if (!source || localesLine === undefined) return undefined;
  const locales = [...localesLine.matchAll(/'([^']+)'/g)].map((m) => m[1] as string);

  const specifiers = new Map<string, string[]>();
  let current: string | undefined;
  for (const line of text.split('\n')) {
    const localeStart = /^\s{2}([A-Za-z0-9-]+): \[\s*$/.exec(line);
    if (localeStart) {
      current = localeStart[1] as string;
      specifiers.set(current, []);
      continue;
    }
    if (/^\s{2}],\s*$/.test(line)) {
      current = undefined;
      continue;
    }
    const specifier = /import\('([^']+)'\)/.exec(line)?.[1];
    // Conflict markers leave stray import lines outside any locale block; a
    // specifier with no open block has no locale to belong to, so skip it.
    if (specifier && current) specifiers.get(current)?.push(specifier);
  }
  return { source, locales, specifiers };
}

/**
 * Classify a path inside `outDir`. Determines which merge policy applies.
 * `undefined` means the file is not one autotranslate owns.
 */
export function classifyPath(path: string): MergeKind | undefined {
  const normalized = path.replace(/\\/g, '/');
  if (normalized === 'index.ts' || normalized.endsWith('/index.ts')) return 'module';
  if (!normalized.endsWith('.json')) return undefined;
  if (normalized.endsWith('/.meta.json') || normalized === '.meta.json') return 'manifest';
  if (normalized.includes('/.state/')) return 'state';
  return 'catalog';
}

export interface MergeDriverArgs {
  /** Common ancestor (`%O`). */
  readonly basePath: string;
  /** Our version; the merge result is written back here (`%A`). */
  readonly oursPath: string;
  /** Their version (`%B`). */
  readonly theirsPath: string;
  /** Path of the file being merged (`%P`), used to pick the policy. */
  readonly filePath?: string;
}

export interface MergeDriverResult {
  readonly kind: MergeKind;
  readonly contested: ReadonlyArray<string>;
}

/**
 * Git merge driver entry point. Git hands us three temp files and expects the
 * result in `oursPath`, with exit code 0 for a clean merge.
 *
 * This driver never fails: every conflict has a deterministic resolution that
 * `autotranslate translate` can correct on the next run, which beats leaving a
 * developer to hand-merge hash-keyed JSON.
 */
export async function runMergeDriver(args: MergeDriverArgs): Promise<MergeDriverResult> {
  const kind = classifyPath(args.filePath ?? args.oursPath) ?? 'catalog';

  if (kind === 'module') {
    const [ours, theirs] = await Promise.all([readText(args.oursPath), readText(args.theirsPath)]);
    await writeFile(args.oursPath, mergeCatalogModule(ours, theirs), 'utf8');
    return { kind, contested: [] };
  }

  const [base, ours, theirs] = await Promise.all([
    readJson(args.basePath),
    readJson(args.oursPath),
    readJson(args.theirsPath),
  ]);

  const outcome =
    kind === 'state' ? mergeState(base, ours, theirs) : mergeCatalog(base, ours, theirs);

  await writeFile(args.oursPath, `${JSON.stringify(outcome.merged, null, 2)}\n`, 'utf8');
  return { kind, contested: outcome.contested };
}

async function readText(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissing(error)) return '';
    throw error;
  }
}

async function readJson(path: string): Promise<JsonRecord> {
  try {
    const text = await readFile(path, 'utf8');
    if (text.trim() === '') return {};
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as JsonRecord) : {};
  } catch (error) {
    // Git passes an empty temp file for "did not exist in this version".
    if (isMissing(error)) return {};
    throw error;
  }
}
