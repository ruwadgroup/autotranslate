import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Catalog, Locale } from '@autotranslate/core';
import { migrateCatalog } from '@autotranslate/core/internal';

export interface LoadedCatalogs {
  readonly source: Locale;
  readonly catalogs: Readonly<Record<Locale, Catalog>>;
}

/**
 * Read every locale's chunked catalog from `<cwd>/<outDir>/<locale>/**`. Falls
 * back to the legacy flat `<locale>.json` when the directory is missing. Each
 * locale's chunks are deep-merged into one `Catalog`.
 */
export async function loadCatalogs(
  cwd: string,
  outDir: string,
  source: Locale,
  locales: ReadonlyArray<Locale>,
): Promise<LoadedCatalogs> {
  const out: Record<Locale, Catalog> = {};
  await Promise.all(
    locales.map(async (locale) => {
      out[locale] = await readLocale(resolve(cwd, outDir), locale);
    }),
  );
  return { source, catalogs: out };
}

async function readLocale(outDir: string, locale: Locale): Promise<Catalog> {
  const localeDir = join(outDir, locale);
  if (await isDirectory(localeDir)) {
    const merged: Catalog = {};
    for (const file of await listJsonFiles(localeDir)) {
      Object.assign(merged, await readJson(file));
    }
    return migrateCatalog(merged);
  }
  return migrateCatalog(await readJson(join(outDir, `${locale}.json`)));
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
    return JSON.parse(await readFile(path, 'utf8')) as Catalog;
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
