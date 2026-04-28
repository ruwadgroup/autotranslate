import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Catalog, Locale } from '@autotranslate/core';

const cache = new Map<string, Promise<Catalog>>();

/**
 * Default fs-backed catalog loader. Reads the chunked tree under
 * `<cwd>/<outDir>/<locale>/**\/*.json` and merges into one catalog. Falls
 * back to the legacy flat `<cwd>/<outDir>/<locale>.json` when the directory
 * is missing — supports 0.1.0 layouts mid-upgrade.
 */
export function fsCatalogLoader(cwd: string, outDir: string): (locale: Locale) => Promise<Catalog> {
  return async (locale) => {
    const key = `${cwd}\0${outDir}\0${locale}`;
    let cached = cache.get(key);
    if (!cached) {
      cached = readLocale(resolve(cwd, outDir), locale);
      cache.set(key, cached);
    }
    return cached;
  };
}

async function readLocale(outDir: string, locale: Locale): Promise<Catalog> {
  const localeDir = join(outDir, locale);
  if (await isDirectory(localeDir)) {
    const out: Catalog = {};
    for (const file of await listJsonFiles(localeDir)) {
      Object.assign(out, await readJson(file));
    }
    return out;
  }
  return readJson(join(outDir, `${locale}.json`));
}

async function listJsonFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listJsonFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  out.sort();
  return out;
}

async function readJson(path: string): Promise<Catalog> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as Catalog;
  } catch (error) {
    if (isMissing(error)) return {};
    throw error;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT'
  );
}

/** Drop the in-process catalog cache. Exposed for tests. */
export function clearCatalogCache(): void {
  cache.clear();
}
