import type { CatalogEntry, Locale, Manifest, MessageMeta } from '@autotranslate/core';
import { buildChunkLayout } from '@autotranslate/core/internal';
import type { Provider, TranslationContextItem, TranslationItem } from '@autotranslate/providers';
import {
  type CatalogFile,
  readChunkedCatalog,
  readManifest,
  writeChunkedCatalog,
} from '../catalog';
import { writeCatalogModule } from '../catalog-module';
import { resolveProvider } from '../provider-resolver';
import {
  contentHash,
  migrateLegacyCache,
  pruneStateChunks,
  readStateChunk,
  stateChunkPath,
  writeStateChunk,
} from '../state';
import type { LocaleStats, ResolvedConfig, TranslateFailure, TranslateResult } from '../types';

export interface TranslateProgress {
  readonly target: Locale;
  /** 1-based index of this batch within the run. */
  readonly batch: number;
  /** Total batches in the run, across every target. */
  readonly totalBatches: number;
  readonly items: number;
  readonly status: 'started' | 'completed' | 'failed';
  readonly fetched?: number;
  readonly error?: Error;
}

/**
 * Reference translations sent alongside a batch for tone consistency. Kept
 * small on purpose: the payload rides along on every batch, so an unbounded
 * count makes prompts grow with catalog size and pushes batches past the size
 * where models answer reliably.
 */
const MAX_CONTEXT_ITEMS = 8;

export interface TranslateOptions {
  /** Programmatic provider override (takes precedence over config). */
  readonly provider?: Provider;
  /** Restrict to a subset of target locales. */
  readonly only?: ReadonlyArray<Locale>;
  /** Override `config.concurrency` for this run. */
  readonly concurrency?: number;
  /** Override `config.batchSize` for this run. */
  readonly batchSize?: number;
  /** Per-batch progress events. Fires for `started`, `completed` and `failed`. */
  readonly onProgress?: (event: TranslateProgress) => void;
}

/**
 * Translate the source catalog into every target locale.
 *
 * Three phases:
 *  1. **Plan** - diff each locale's committed catalog against the source using
 *     the recorded source hashes. Unchanged keys with a translation on disk are
 *     reused and never re-sent.
 *  2. **Fetch** - collapse duplicate copy, split the remainder into uniform
 *     batches and run them with bounded concurrency. Batch size is independent
 *     of how keys happen to land in chunk buckets, and a failing batch is
 *     isolated from the rest of the run.
 *  3. **Commit** - write catalogs and per-chunk state. Keys the provider never
 *     answered for keep their previous translation and stay out of state, so
 *     the next run retries exactly those.
 */
export async function translate(
  resolved: ResolvedConfig,
  options: TranslateOptions = {},
): Promise<TranslateResult> {
  const { config, outDir } = resolved;
  const provider = options.provider ?? (await resolveProvider(resolved));
  const sourceCatalog = await readChunkedCatalog(outDir, config.source);
  const manifest = await readManifest(outDir);

  const mergedInstruction = mergeInstruction(config.instruction, config.glossary);

  const requested = options.only
    ? config.targets.filter((t) => options.only?.includes(t))
    : config.targets;

  const stats: LocaleStats = {};
  for (const t of requested) stats[t] = { fetched: 0, cached: 0, overridden: 0 };

  const targets = requested.filter((t): t is Locale => t !== config.source);
  if (targets.length === 0) return { stats, failures: [] };

  await migrateLegacyCache(outDir, config.source, targets);

  const filtered: Record<string, MessageMeta | undefined> = {};
  for (const k of Object.keys(sourceCatalog)) filtered[k] = manifest[k];
  const layout = buildChunkLayout(filtered);

  // ---- Phase 1: plan -----------------------------------------------------
  const plans = new Map<Locale, LocalePlan>();
  await Promise.all(
    targets.map(async (target) => {
      const plan = await planTarget({
        outDir,
        target,
        layout,
        sourceCatalog,
        manifest,
        overrides: config.overrides,
      });
      plans.set(target, plan);
      stats[target] = {
        fetched: 0,
        cached: plan.cached,
        overridden: plan.overridden,
      };
    }),
  );

  // ---- Phase 2: fetch ----------------------------------------------------
  const batchSize = Math.max(1, options.batchSize ?? config.batchSize);
  const batches: Batch[] = [];
  for (const target of targets) {
    const plan = plans.get(target);
    if (!plan) continue;
    for (const slice of chunkArray(plan.toFetch, batchSize)) {
      batches.push({ target, items: slice });
    }
  }

  const concurrency = Math.max(1, options.concurrency ?? config.concurrency);
  const onProgress = options.onProgress;
  const failures: TranslateFailure[] = [];
  let batchNumber = 0;

  await runWithConcurrency(batches, concurrency, async (batch) => {
    batchNumber += 1;
    const index = batchNumber;
    const plan = plans.get(batch.target);
    if (!plan) return;
    const event = {
      target: batch.target,
      batch: index,
      totalBatches: batches.length,
      items: batch.items.length,
    };
    onProgress?.({ ...event, status: 'started' });
    try {
      const result = await provider.translate({
        source: config.source,
        target: batch.target,
        items: batch.items,
        ...(plan.context.length > 0 ? { context: plan.context } : {}),
        ...(mergedInstruction ? { instruction: mergedInstruction } : {}),
      });
      let fetched = 0;
      for (const item of batch.items) {
        const translation = result.translations[item.key];
        // A key the provider skipped keeps its previous translation and stays
        // out of state, so the next run retries it. Never write a hole.
        if (translation === undefined) continue;
        for (const key of plan.aliases.get(item.key) ?? [item.key]) {
          plan.translated.set(key, translation);
          fetched += 1;
        }
      }
      const s = stats[batch.target];
      if (s) stats[batch.target] = { ...s, fetched: s.fetched + fetched };
      onProgress?.({ ...event, status: 'completed', fetched });
    } catch (error) {
      // One bad batch must not discard the run. Everything else still commits.
      const err = error instanceof Error ? error : new Error(String(error));
      failures.push({
        target: batch.target,
        keys: batch.items.flatMap((i) => plan.aliases.get(i.key) ?? [i.key]),
        error: err,
      });
      onProgress?.({ ...event, status: 'failed', error: err });
    }
  });

  // ---- Phase 3: commit ---------------------------------------------------
  await Promise.all(
    targets.map(async (target) => {
      const plan = plans.get(target);
      if (!plan) return;
      const catalog: CatalogFile = {};
      // Keys nobody answered for fall back to whatever is already committed.
      for (const [key, value] of plan.carryForward) catalog[key] = value;
      for (const [key, value] of plan.settled) catalog[key] = value;
      for (const [key, value] of plan.translated) catalog[key] = value;

      await writeChunkedCatalog(outDir, target, catalog, manifest);
      await commitState({ outDir, target, plan, layout });
      await pruneStateChunks(outDir, target, new Set(layout.keys()));
    }),
  );

  await writeCatalogModule(outDir, config.source, [config.source, ...config.targets]);

  return { stats, failures };
}

interface Batch {
  readonly target: Locale;
  readonly items: ReadonlyArray<TranslationItem>;
}

interface LocalePlan {
  /** Keys that already have a current translation: reused or overridden. */
  readonly settled: Map<string, CatalogEntry>;
  /** Previous translations for keys being re-fetched, used if a fetch fails. */
  readonly carryForward: Map<string, CatalogEntry>;
  /** Deduped items to send to the provider. */
  readonly toFetch: ReadonlyArray<TranslationItem>;
  /** Representative key -> every key sharing that exact source and guidance. */
  readonly aliases: Map<string, ReadonlyArray<string>>;
  /** Source hash per key, for the state file. */
  readonly hashes: Map<string, string>;
  /** Bounded reference sample for tone consistency. */
  readonly context: ReadonlyArray<TranslationContextItem>;
  /** Filled during phase 2. */
  readonly translated: Map<string, CatalogEntry>;
  readonly cached: number;
  readonly overridden: number;
}

interface PlanTargetArgs {
  readonly outDir: string;
  readonly target: Locale;
  readonly layout: Map<string, ReadonlyArray<string>>;
  readonly sourceCatalog: CatalogFile;
  readonly manifest: Manifest;
  readonly overrides: ResolvedConfig['config']['overrides'];
}

async function planTarget(args: PlanTargetArgs): Promise<LocalePlan> {
  const { outDir, target, layout, sourceCatalog, manifest } = args;
  const existing = await readChunkedCatalog(outDir, target);
  const targetOverrides = args.overrides?.[target] ?? {};

  const settled = new Map<string, CatalogEntry>();
  const carryForward = new Map<string, CatalogEntry>();
  const hashes = new Map<string, string>();
  const context: TranslationContextItem[] = [];
  const pending: TranslationItem[] = [];
  let cached = 0;
  let overridden = 0;

  for (const [chunkPath, keys] of layout) {
    const state = await readStateChunk(stateChunkPath(outDir, target, chunkPath));
    for (const key of keys) {
      const sourceEntry = sourceCatalog[key];
      if (sourceEntry === undefined) continue;
      hashes.set(key, contentHash(sourceEntry));

      // Overrides are user-keyed by source string for ergonomics; storage is
      // keyed by hash. Look up overrides via the literal source value.
      const literalSource = typeof sourceEntry === 'string' ? sourceEntry : undefined;
      const overrideValue = literalSource ? targetOverrides[literalSource] : undefined;
      if (overrideValue !== undefined) {
        settled.set(key, overrideValue);
        overridden += 1;
        continue;
      }

      const previous = existing[key];
      if (previous !== undefined && state.keys[key] === hashes.get(key)) {
        settled.set(key, previous);
        cached += 1;
        if (context.length < MAX_CONTEXT_ITEMS) {
          context.push({ source: sourceEntry, translation: previous });
        }
        continue;
      }

      if (previous !== undefined) carryForward.set(key, previous);
      const meta = manifest[key];
      pending.push({
        key,
        source: sourceEntry,
        ...(meta?.context ? { context: meta.context } : {}),
        ...(meta?.description ? { description: meta.description } : {}),
        ...(typeof meta?.maxChars === 'number' ? { maxChars: meta.maxChars } : {}),
      });
    }
  }

  const { items, aliases } = dedupeItems(pending);
  return {
    settled,
    carryForward,
    toFetch: items,
    aliases,
    hashes,
    context,
    translated: new Map(),
    cached,
    overridden,
  };
}

interface CommitStateArgs {
  readonly outDir: string;
  readonly target: Locale;
  readonly plan: LocalePlan;
  readonly layout: Map<string, ReadonlyArray<string>>;
}

/**
 * Record the source hash for every key that now has a current translation.
 * Keys that failed or were skipped are omitted, which is what makes the next
 * run retry precisely those and nothing else.
 */
async function commitState(args: CommitStateArgs): Promise<void> {
  const { outDir, target, plan, layout } = args;
  await Promise.all(
    [...layout].map(async ([chunkPath, keys]) => {
      const chunkKeys: Record<string, string> = {};
      for (const key of keys) {
        if (!plan.settled.has(key) && !plan.translated.has(key)) continue;
        const hash = plan.hashes.get(key);
        if (hash !== undefined) chunkKeys[key] = hash;
      }
      await writeStateChunk(stateChunkPath(outDir, target, chunkPath), chunkKeys);
    }),
  );
}

/**
 * Collapse items whose source and guidance are identical to a single request
 * item. The same copy routinely appears under several keys (per-context keys,
 * repeated labels) and hash bucketing scatters them across chunks - translating
 * each separately is duplicate spend and invites two different renderings of
 * the same string.
 */
function dedupeItems(items: ReadonlyArray<TranslationItem>): {
  readonly items: ReadonlyArray<TranslationItem>;
  readonly aliases: Map<string, ReadonlyArray<string>>;
} {
  const unique: TranslationItem[] = [];
  const aliases = new Map<string, string[]>();
  const byFingerprint = new Map<string, string>();
  for (const item of items) {
    const fingerprint = JSON.stringify([
      item.source,
      item.context ?? null,
      item.description ?? null,
      item.maxChars ?? null,
    ]);
    const representative = byFingerprint.get(fingerprint);
    if (representative !== undefined) {
      aliases.get(representative)?.push(item.key);
      continue;
    }
    byFingerprint.set(fingerprint, item.key);
    aliases.set(item.key, [item.key]);
    unique.push(item);
  }
  return { items: unique, aliases };
}

function chunkArray<T>(items: ReadonlyArray<T>, size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function runWithConcurrency<T>(
  items: ReadonlyArray<T>,
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function pump(): Promise<void> {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      await worker(items[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => pump()));
}

function mergeInstruction(
  instruction: string | undefined,
  glossary: ReadonlyArray<string> | undefined,
): string | undefined {
  if (!glossary || glossary.length === 0) return instruction;
  const preamble =
    'Glossary - preserve these terms exactly; never translate or transliterate:\n' +
    glossary.map((term) => `- ${term}`).join('\n');
  return instruction ? `${preamble}\n\n${instruction}` : preamble;
}

export type { CatalogEntry };
