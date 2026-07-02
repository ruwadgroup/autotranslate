import { execFile as execFileCb } from 'node:child_process';
import { relative } from 'node:path';
import { promisify } from 'node:util';
import { isStructured } from '@autotranslate/core';
import { ICUParseError, parseICU } from '@autotranslate/core/icu';
import { readChunkedCatalog } from '../catalog';
import type { CheckProblem, ResolvedConfig } from '../types';

const execFile = promisify(execFileCb);

/** Maximum rows emitted in the github-format table before truncating. */
const TABLE_ROW_CAP = 50;

export interface ParityEntry {
  readonly key: string;
  readonly sourceText: string;
  readonly translations: Record<string, string | null>;
}

export interface ParityChangedEntry extends ParityEntry {
  readonly previousSourceText: string;
}

export interface ParityReport {
  readonly added: ReadonlyArray<ParityEntry>;
  readonly changed: ReadonlyArray<ParityChangedEntry>;
  readonly removed: ReadonlyArray<string>;
  readonly problems: ReadonlyArray<CheckProblem>;
  readonly ok: boolean;
}

/** Run a git command in the given cwd and return stdout as a string. */
async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFile('git', args, { cwd });
  return stdout;
}

type CatalogFile = Record<string, unknown>;

/**
 * Read the chunked catalog for `locale` at `ref` (a git ref / SHA) by
 * enumerating `git ls-tree` and reading each blob with `git show`.
 *
 * `outDirRelative` is the repo-relative path to the outDir directory
 * (e.g. `.translations`).
 */
async function readBaseCatalog(
  cwd: string,
  ref: string,
  outDirRelative: string,
  locale: string,
): Promise<CatalogFile> {
  const localePrefix = `${outDirRelative}/${locale}/`;

  let lsOutput: string;
  try {
    lsOutput = await git(cwd, ['ls-tree', '-r', '--name-only', ref, '--', localePrefix]);
  } catch {
    // locale directory does not exist at base ref - catalog is empty.
    return {};
  }

  const paths = lsOutput
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.endsWith('.json'));

  if (paths.length === 0) return {};

  const merged: CatalogFile = {};
  for (const p of paths) {
    let content: string;
    try {
      content = await git(cwd, ['show', `${ref}:${p}`]);
    } catch {
      continue;
    }
    try {
      const chunk = JSON.parse(content) as CatalogFile;
      Object.assign(merged, chunk);
    } catch {
      // malformed chunk - skip
    }
  }
  return merged;
}

function validateICU(message: string): string | null {
  try {
    parseICU(message);
    return null;
  } catch (error) {
    return error instanceof ICUParseError ? error.message : 'parse failed';
  }
}

function entryToText(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Compute the parity report between the base git ref and the current
 * working-tree catalogs.
 */
export async function parity(
  resolved: ResolvedConfig,
  options: { base?: string; format?: 'text' | 'github' } = {},
): Promise<ParityReport> {
  const { config, outDir, cwd } = resolved;
  const base = options.base ?? 'origin/main';

  const outDirRelative = relative(cwd, outDir) || '.translations';

  const baseSource = await readBaseCatalog(cwd, base, outDirRelative, config.source);

  const currentSource = await readChunkedCatalog(outDir, config.source);

  const baseSourceKeys = new Set(Object.keys(baseSource));
  const currentSourceKeys = new Set(Object.keys(currentSource));

  const addedKeys = [...currentSourceKeys].filter((k) => !baseSourceKeys.has(k));
  const removedKeys = [...baseSourceKeys].filter((k) => !currentSourceKeys.has(k));
  const potentiallyChangedKeys = [...currentSourceKeys].filter((k) => baseSourceKeys.has(k));

  const changedKeys = potentiallyChangedKeys.filter(
    (k) => entryToText(baseSource[k]) !== entryToText(currentSource[k]),
  );

  const targets = config.targets.filter((t) => t !== config.source);
  const currentTargetCatalogs = new Map<string, CatalogFile>();
  for (const target of targets) {
    currentTargetCatalogs.set(target, await readChunkedCatalog(outDir, target));
  }

  const added: ParityEntry[] = addedKeys.map((key) => {
    const translations: Record<string, string | null> = {};
    for (const target of targets) {
      const v = currentTargetCatalogs.get(target)?.[key];
      translations[target] = v !== undefined ? entryToText(v) : null;
    }
    return { key, sourceText: entryToText(currentSource[key]), translations };
  });

  const changed: ParityChangedEntry[] = changedKeys.map((key) => {
    const translations: Record<string, string | null> = {};
    for (const target of targets) {
      const v = currentTargetCatalogs.get(target)?.[key];
      translations[target] = v !== undefined ? entryToText(v) : null;
    }
    return {
      key,
      sourceText: entryToText(currentSource[key]),
      previousSourceText: entryToText(baseSource[key]),
      translations,
    };
  });

  const problems: CheckProblem[] = [];

  for (const [key, value] of Object.entries(currentSource)) {
    if (typeof value === 'string') {
      const err = validateICU(value);
      if (err) problems.push({ locale: config.source, key, kind: 'invalid-icu', message: err });
    }
  }

  for (const target of targets) {
    const targetCatalog = currentTargetCatalogs.get(target) ?? {};
    const targetKeys = new Set(Object.keys(targetCatalog));

    for (const key of currentSourceKeys) {
      if (!targetKeys.has(key)) {
        problems.push({ locale: target, key, kind: 'missing' });
      }
    }
    for (const key of targetKeys) {
      if (!currentSourceKeys.has(key)) {
        problems.push({ locale: target, key, kind: 'orphan' });
      }
    }
    for (const [key, value] of Object.entries(targetCatalog)) {
      if (typeof value === 'string') {
        const err = validateICU(value);
        if (err) problems.push({ locale: target, key, kind: 'invalid-icu', message: err });
      } else if (!isStructured(value)) {
        problems.push({
          locale: target,
          key,
          kind: 'invalid-icu',
          message: 'expected string or structured tree',
        });
      }
    }
  }

  return {
    added,
    changed,
    removed: removedKeys,
    problems,
    ok: problems.length === 0,
  };
}

/**
 * Format a `ParityReport` as either `github` markdown or plain `text`.
 *
 * `github` format: header with counts + completeness, markdown table capped at
 * 50 rows, `<sub>` footer.
 * `text` format: plain human-readable summary lines.
 */
export function formatParityReport(
  report: ParityReport,
  format: 'text' | 'github' = 'text',
): string {
  if (format === 'text') {
    return formatText(report);
  }
  return formatGithub(report);
}

function formatText(report: ParityReport): string {
  const lines: string[] = [];
  if (report.added.length > 0) lines.push(`${report.added.length} string(s) added`);
  if (report.changed.length > 0) lines.push(`${report.changed.length} string(s) changed`);
  if (report.removed.length > 0) lines.push(`${report.removed.length} string(s) removed`);
  if (report.problems.length > 0) {
    lines.push(`${report.problems.length} problem(s):`);
    for (const p of report.problems) {
      lines.push(`  ${p.kind} [${p.locale}] ${p.key}${p.message ? ` - ${p.message}` : ''}`);
    }
  }
  if (lines.length === 0) lines.push('no changes');
  return lines.join('\n');
}

function formatGithub(report: ParityReport): string {
  const targetLocales = gatherTargetLocales(report);

  const addedCount = report.added.length;
  const changedCount = report.changed.length;
  const removedCount = report.removed.length;

  const parts: string[] = [];
  if (addedCount > 0) parts.push(`${addedCount} string${addedCount === 1 ? '' : 's'} added`);
  if (changedCount > 0)
    parts.push(`${changedCount} string${changedCount === 1 ? '' : 's'} changed`);
  if (removedCount > 0)
    parts.push(`${removedCount} string${removedCount === 1 ? '' : 's'} removed`);
  if (parts.length === 0) parts.push('no changes');

  const completeness = computeCompleteness(report, targetLocales);
  const countLine = `**${parts.join(' / ')} - ${completeness}**`;

  const lines: string[] = ['## autotranslate - catalog parity', '', countLine];

  const tableRows = buildTableRows(report, targetLocales);
  if (tableRows.length > 0) {
    lines.push('');
    const headerCols = ['source (en)', ...targetLocales];
    lines.push(`| ${headerCols.join(' | ')} |`);
    lines.push(`|${headerCols.map(() => '---').join('|')}|`);

    const visible = tableRows.slice(0, TABLE_ROW_CAP);
    const overflow = tableRows.length - visible.length;

    for (const row of visible) {
      lines.push(`| ${row.join(' | ')} |`);
    }
    if (overflow > 0) {
      lines.push('');
      lines.push(`+${overflow} more`);
    }
  }

  if (report.problems.length > 0) {
    lines.push('');
    lines.push(
      `> **${report.problems.length} problem${report.problems.length === 1 ? '' : 's'}**: ` +
        report.problems
          .slice(0, 5)
          .map((p) => `${p.kind} in ${p.locale} - \`${p.key}\``)
          .join(', ') +
        (report.problems.length > 5 ? ` +${report.problems.length - 5} more` : ''),
    );
  }

  lines.push('');
  lines.push('<sub>generated by autotranslate parity</sub>');

  return lines.join('\n');
}

function gatherTargetLocales(report: ParityReport): string[] {
  const seen = new Set<string>();
  for (const entry of [...report.added, ...report.changed]) {
    for (const locale of Object.keys(entry.translations)) {
      seen.add(locale);
    }
  }
  return [...seen].sort();
}

function computeCompleteness(report: ParityReport, targetLocales: string[]): string {
  const localeCount = targetLocales.length;
  if (localeCount === 0) return 'no target locales';

  if (report.problems.length === 0) {
    return `all ${localeCount} locale${localeCount === 1 ? '' : 's'} complete`;
  }

  const missingLocales = new Set(
    report.problems.filter((p) => p.kind === 'missing').map((p) => p.locale),
  );
  const incomplete = targetLocales.filter((l) => missingLocales.has(l));

  if (incomplete.length === 0) {
    return `all ${localeCount} locale${localeCount === 1 ? '' : 's'} complete`;
  }
  return `${incomplete.length} locale${incomplete.length === 1 ? '' : 's'} incomplete`;
}

type TableRow = string[];

function buildTableRows(report: ParityReport, targetLocales: string[]): TableRow[] {
  const rows: TableRow[] = [];

  for (const entry of report.added) {
    const sourceCell = escapeCell(entry.sourceText);
    const targetCells = targetLocales.map((l) => {
      const v = entry.translations[l];
      return v !== null && v !== undefined ? escapeCell(v) : '_(missing)_';
    });
    rows.push([sourceCell, ...targetCells]);
  }

  for (const entry of report.changed) {
    const sourceCell = `~~${escapeCell(entry.previousSourceText)}~~ ${escapeCell(entry.sourceText)}`;
    const targetCells = targetLocales.map((l) => {
      const v = entry.translations[l];
      return v !== null && v !== undefined ? escapeCell(v) : '_(missing)_';
    });
    rows.push([sourceCell, ...targetCells]);
  }

  return rows;
}

/** Minimal escaping so pipe characters don't break the markdown table. */
function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
