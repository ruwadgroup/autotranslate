import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Catalog, Locale } from '@autotranslate/core';

export interface LoadedCatalogs {
  readonly source: Locale;
  readonly catalogs: Readonly<Record<Locale, Catalog>>;
}

/** Read every `<locale>.json` from `<cwd>/<outDir>`. Missing files surface as `{}`. */
export async function loadCatalogs(
  cwd: string,
  outDir: string,
  source: Locale,
  locales: ReadonlyArray<Locale>,
): Promise<LoadedCatalogs> {
  const out: Record<Locale, Catalog> = {};
  await Promise.all(
    locales.map(async (locale) => {
      out[locale] = await readCatalog(resolve(cwd, outDir, `${locale}.json`));
    }),
  );
  return { source, catalogs: out };
}

async function readCatalog(path: string): Promise<Catalog> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Catalog;
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
