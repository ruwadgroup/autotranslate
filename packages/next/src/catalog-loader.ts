import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Catalog, Locale } from '@autotranslate/core';
import { migrateCatalog } from '@autotranslate/core/internal';

const cache = new Map<string, Promise<Catalog>>();

/**
 * Default fs-backed catalog loader. Reads `<cwd>/<outDir>/<locale>/**\/*.json`
 * and merges into one catalog. Falls back to the flat `<locale>.json` for
 * 0.1.0 layouts mid-upgrade. `extraRoots` are tried in order when the primary
 * root has no entry — for monorepo standalone builds where `server.js` chdirs
 * away from the project root before any catalog read.
 */
export function fsCatalogLoader(
  cwd: string,
  outDir: string,
  options: { readonly extraRoots?: ReadonlyArray<string> } = {},
): (locale: Locale) => Promise<Catalog> {
  const roots = [resolve(cwd, outDir), ...(options.extraRoots ?? [])];

  return async (locale) => {
    const key = `${roots.join('|')}\0${locale}`;
    let cached = cache.get(key);
    if (!cached) {
      cached = readFirstAvailable(roots, locale);
      cache.set(key, cached);
    }
    return cached;
  };
}

async function readFirstAvailable(roots: ReadonlyArray<string>, locale: Locale): Promise<Catalog> {
  for (const root of roots) {
    const localeDir = join(root, locale);
    if (await isDirectory(localeDir)) return readLocaleDir(localeDir);
    const flatFile = join(root, `${locale}.json`);
    if (await fileExists(flatFile)) return migrateCatalog(await readJson(flatFile));
  }
  // Empty catalog → callers fall through to source-locale rendering instead
  // of throwing. Keeps prod alive even when the catalog is misplaced.
  return {};
}

async function readLocaleDir(localeDir: string): Promise<Catalog> {
  const merged: Catalog = {};
  for (const file of await listJsonFiles(localeDir)) {
    Object.assign(merged, await readJson(file));
  }
  return migrateCatalog(merged);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
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

export function clearCatalogCache(): void {
  cache.clear();
}
