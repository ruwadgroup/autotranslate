import { resolve } from 'node:path';
import { isStructured } from '@autotranslate/core';
import { ICUParseError, parseICU } from '@autotranslate/core/icu';
import { localeCatalogPath, readCatalog } from '../catalog';
import type { CheckProblem, CheckResult, ResolvedConfig } from '../types';

/**
 * Verify catalog parity. Reports `missing`, `orphan`, and `invalid-icu`
 * problems. Returns `ok: false` when any problem is found (CI-friendly).
 */
export async function check(resolved: ResolvedConfig): Promise<CheckResult> {
  const { config, outDir } = resolved;
  const sourceCatalog = await readCatalog(resolve(outDir, `${config.source}.json`));
  const sourceKeys = new Set(Object.keys(sourceCatalog));

  const problems: CheckProblem[] = [];

  for (const [key, value] of Object.entries(sourceCatalog)) {
    if (typeof value === 'string') {
      const err = validateICU(value);
      if (err) problems.push({ locale: config.source, key, kind: 'invalid-icu', message: err });
    }
  }

  for (const target of config.targets) {
    if (target === config.source) continue;
    const targetCatalog = await readCatalog(localeCatalogPath(outDir, target));
    const targetKeys = new Set(Object.keys(targetCatalog));

    for (const key of sourceKeys) {
      if (!targetKeys.has(key)) {
        problems.push({ locale: target, key, kind: 'missing' });
      }
    }
    for (const key of targetKeys) {
      if (!sourceKeys.has(key)) {
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

  return { problems, ok: problems.length === 0 };
}

function validateICU(message: string): string | null {
  try {
    parseICU(message);
    return null;
  } catch (error) {
    return error instanceof ICUParseError ? error.message : 'parse failed';
  }
}
