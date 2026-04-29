import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { readChunkedCatalog, readManifest, writeChunkedCatalog, writeManifest } from '../catalog';
import type { ResolvedConfig } from '../types';

export interface MigrateResult {
  /** Locales whose catalogs were re-shaped. */
  readonly locales: ReadonlyArray<string>;
  /** Total keys migrated across all locales. */
  readonly keyCount: number;
  /** Whether the legacy provider cache was pruned. */
  readonly cacheCleared: boolean;
}

/**
 * Migrate the on-disk catalog from the pre-1.0.0-beta.2 source-tree-mirroring
 * layout to the hash-bucketed layout.
 *
 * The reader transparently rekeys to the hashed format, so this command's
 * real work is forcing every locale through the writer (which lays down the
 * new files and removes the old source-path-shaped chunks). The provider
 * cache is dropped — it was keyed by the old chunk paths and would never
 * hit again under the new layout anyway.
 */
export async function migrate(resolved: ResolvedConfig): Promise<MigrateResult> {
  const { config, outDir } = resolved;
  const locales = [config.source, ...config.targets.filter((t) => t !== config.source)];

  const manifest = await readManifest(outDir);
  await writeManifest(outDir, manifest);

  let keyCount = 0;
  const migrated: string[] = [];
  for (const locale of locales) {
    const catalog = await readChunkedCatalog(outDir, locale);
    const keys = Object.keys(catalog);
    if (keys.length === 0) continue;
    await writeChunkedCatalog(outDir, locale, catalog, manifest);
    migrated.push(locale);
    keyCount += keys.length;
  }

  const cacheDir = join(outDir, '.cache');
  let cacheCleared = false;
  try {
    await rm(cacheDir, { recursive: true, force: true });
    cacheCleared = true;
  } catch {
    // best-effort
  }

  return { locales: migrated, keyCount, cacheCleared };
}
