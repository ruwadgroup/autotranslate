import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildChunkLayout, type ChunkPathOptions } from '@autotranslate/core/internal';
import type { CatalogEntry, Manifest, MessageMeta } from './types';

export type CatalogFile = Record<string, CatalogEntry>;

const META_FILENAME = '.meta.json';

/** Read a single JSON catalog file. Returns `{}` on ENOENT. */
async function readJsonFile(path: string): Promise<CatalogFile> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as CatalogFile;
  } catch (error) {
    if (isMissing(error)) return {};
    throw error;
  }
}

/**
 * Read all chunks for a locale and merge into one catalog. Walks
 * `<outDir>/<locale>/**\/*.json` recursively. Falls back to the legacy flat
 * `<outDir>/<locale>.json` when the directory is missing — this lets 0.1.0
 * users upgrade without losing data on first read.
 */
export async function readChunkedCatalog(outDir: string, locale: string): Promise<CatalogFile> {
  const localeDir = join(outDir, locale);
  if (await isDirectory(localeDir)) {
    const out: CatalogFile = {};
    for (const file of await listJsonFilesRecursive(localeDir)) {
      Object.assign(out, await readJsonFile(file));
    }
    return out;
  }
  return readJsonFile(join(outDir, `${locale}.json`));
}

export interface WriteChunkedResult {
  readonly chunkCount: number;
  readonly keyCount: number;
}

/**
 * Write a catalog as chunked files based on the manifest's per-key occurrences.
 * Removes any existing chunk files not present in the new layout. Removes the
 * legacy flat file (if present) after writing the chunked layout.
 */
export async function writeChunkedCatalog(
  outDir: string,
  locale: string,
  catalog: CatalogFile,
  manifest: Manifest,
  options: ChunkPathOptions = {},
): Promise<WriteChunkedResult> {
  const localeDir = join(outDir, locale);

  const filtered: Record<string, MessageMeta | undefined> = {};
  for (const key of Object.keys(catalog)) filtered[key] = manifest[key];
  const layout = buildChunkLayout(filtered, options);

  const existing = (await isDirectory(localeDir)) ? await listJsonFilesRecursive(localeDir) : [];

  await mkdir(localeDir, { recursive: true });

  const written = new Set<string>();
  for (const [chunkPath, keys] of layout) {
    const filePath = join(localeDir, `${chunkPath}.json`);
    written.add(filePath);
    const data: CatalogFile = {};
    for (const key of keys) {
      const v = catalog[key];
      if (v !== undefined) data[key] = v;
    }
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  for (const file of existing) {
    if (!written.has(file)) await rm(file, { force: true });
  }
  await pruneEmptyDirsBelow(localeDir);

  const flatFile = join(outDir, `${locale}.json`);
  if (await fileExists(flatFile)) await rm(flatFile, { force: true });

  return { chunkCount: layout.size, keyCount: Object.keys(catalog).length };
}

export async function readManifest(outDir: string): Promise<Manifest> {
  const data = await readJsonFile(join(outDir, META_FILENAME));
  return data as unknown as Manifest;
}

export async function writeManifest(outDir: string, manifest: Manifest): Promise<void> {
  const path = join(outDir, META_FILENAME);
  await mkdir(outDir, { recursive: true });
  const sorted = sortKeys(manifest as unknown as Record<string, unknown>);
  await writeFile(path, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

export function isMissing(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT'
  );
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

async function listJsonFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listJsonFilesRecursive(full)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  out.sort();
  return out;
}

async function pruneEmptyDirsBelow(root: string): Promise<void> {
  if (!(await isDirectory(root))) return;
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) await pruneEmptyDirsBelow(join(root, entry.name));
  }
  const after = await readdir(root);
  if (after.length === 0 && root !== '/') {
    try {
      await rm(root, { recursive: false });
    } catch {
      // best-effort
    }
  }
}

function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out as T;
}
