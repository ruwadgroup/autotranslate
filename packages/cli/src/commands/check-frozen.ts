import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { CatalogEntry } from '@autotranslate/core';
import { isMissing, readChunkedCatalog } from '../catalog';
import type { CheckProblem, ResolvedConfig } from '../types';
import { check } from './check';
import { collectExtraction } from './extract';

export interface FrozenReport {
  readonly ok: boolean;
  readonly missingSource: ReadonlyArray<{
    readonly key: string;
    readonly text: string;
    readonly occurrence: string;
  }>;
  readonly problems: ReadonlyArray<CheckProblem>;
  readonly catalogAbsent: boolean;
}

/**
 * Frozen-build check: compares live extraction against the committed source
 * catalog and runs existing check() comparisons for target locales.
 *
 * - Source catalog directory AND legacy flat file both absent -> fresh project,
 *   returns `{ ok: true, catalogAbsent: true }` so example projects in CI
 *   never fail.
 * - Otherwise: keys in live code not in committed catalog -> `missingSource`
 *   (with first occurrence file:line and source text); target problems via
 *   existing check() logic -> `problems`.
 */
export async function checkFrozen(resolved: ResolvedConfig): Promise<FrozenReport> {
  const { config, outDir } = resolved;
  const sourceDir = join(outDir, config.source);

  if (!(await pathExists(sourceDir))) {
    return { ok: true, catalogAbsent: true, missingSource: [], problems: [] };
  }

  const extracted = await collectExtraction(resolved);
  const committed = await readChunkedCatalog(outDir, config.source);
  const committedKeys = new Set(Object.keys(committed));

  const missingSource: Array<{ key: string; text: string; occurrence: string }> = [];
  for (const [key, entry] of Object.entries(extracted.source)) {
    if (committedKeys.has(key)) continue;
    const meta = extracted.manifest[key];
    const occ = meta?.occurrences?.[0];
    const occurrence = occ ? `${occ.file}:${occ.line}` : 'unknown';
    const text = sourceTextOf(entry, key);
    missingSource.push({ key, text, occurrence });
  }

  const checkResult = await check(resolved);

  const ok = missingSource.length === 0 && checkResult.ok;
  return { ok, missingSource, problems: checkResult.problems, catalogAbsent: false };
}

function sourceTextOf(entry: CatalogEntry, fallbackKey: string): string {
  return typeof entry === 'string' ? entry : fallbackKey;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

/**
 * Format a FrozenReport as a human-readable string.
 * Returns an empty string when `report.ok` is true.
 */
export function formatFrozenReport(report: FrozenReport): string {
  if (report.ok) return '';

  const lines: string[] = ['Catalog is out of date.', ''];

  if (report.missingSource.length > 0) {
    const n = report.missingSource.length;
    lines.push(`${n} source string${n === 1 ? '' : 's'} not committed to .translations:`);
    for (const item of report.missingSource) {
      lines.push(`  - '${item.text}' (${item.occurrence})`);
    }
    lines.push('');
  }

  if (report.problems.length > 0) {
    const byLocale = new Map<string, CheckProblem[]>();
    for (const p of report.problems) {
      const bucket = byLocale.get(p.locale) ?? [];
      bucket.push(p);
      byLocale.set(p.locale, bucket);
    }
    for (const [locale, probs] of byLocale) {
      const missing = probs.filter((p) => p.kind === 'missing');
      const orphans = probs.filter((p) => p.kind === 'orphan');
      const invalid = probs.filter((p) => p.kind === 'invalid-icu');
      if (missing.length > 0) {
        lines.push(
          `${missing.length} string${missing.length === 1 ? '' : 's'} missing in ${locale}:`,
        );
        for (const p of missing) lines.push(`  - ${p.key}`);
        lines.push('');
      }
      if (orphans.length > 0) {
        lines.push(`${orphans.length} orphan${orphans.length === 1 ? '' : 's'} in ${locale}:`);
        for (const p of orphans) lines.push(`  - ${p.key}`);
        lines.push('');
      }
      if (invalid.length > 0) {
        lines.push(
          `${invalid.length} invalid ICU string${invalid.length === 1 ? '' : 's'} in ${locale}:`,
        );
        for (const p of invalid) {
          lines.push(`  - ${p.key}${p.message ? `: ${p.message}` : ''}`);
        }
        lines.push('');
      }
    }
  }

  lines.push('Run your dev server or `autotranslate translate`, then commit .translations/');

  return lines.join('\n');
}
