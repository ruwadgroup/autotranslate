import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Catalog, Locale } from '@autotranslate/core';

const cache = new Map<string, Promise<Catalog>>();

/**
 * Default fs-backed catalog loader. Reads `<cwd>/<outDir>/<locale>.json` and
 * memoizes per (cwd, outDir, locale).
 */
export function fsCatalogLoader(cwd: string, outDir: string): (locale: Locale) => Promise<Catalog> {
  return async (locale) => {
    const key = `${cwd}\0${outDir}\0${locale}`;
    let cached = cache.get(key);
    if (!cached) {
      cached = readCatalog(resolve(cwd, outDir, `${locale}.json`));
      cache.set(key, cached);
    }
    return cached;
  };
}

async function readCatalog(path: string): Promise<Catalog> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as Catalog;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return {};
    }
    throw error;
  }
}

/** Drop the in-process catalog cache. Exposed for tests. */
export function clearCatalogCache(): void {
  cache.clear();
}
