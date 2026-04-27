import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { CatalogEntry, Manifest } from './types';

export type CatalogFile = Record<string, CatalogEntry>;

const META_FILENAME = '.meta.json';

/** Read a catalog from disk. Returns `{}` if the file is missing. */
export async function readCatalog(path: string): Promise<CatalogFile> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as CatalogFile;
  } catch (error) {
    if (isMissing(error)) return {};
    throw error;
  }
}

/** Write a catalog to disk, sorted for stable diffs. */
export async function writeCatalog(path: string, catalog: CatalogFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const sorted = sortKeys(catalog);
  await writeFile(path, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

export async function readManifest(outDir: string): Promise<Manifest> {
  return (await readCatalog(join(outDir, META_FILENAME))) as unknown as Manifest;
}

export async function writeManifest(outDir: string, manifest: Manifest): Promise<void> {
  await writeCatalog(join(outDir, META_FILENAME), manifest as unknown as CatalogFile);
}

export function localeCatalogPath(outDir: string, locale: string): string {
  return join(outDir, `${locale}.json`);
}

export function isMissing(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT'
  );
}

function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = obj[k];
  }
  return out as T;
}
