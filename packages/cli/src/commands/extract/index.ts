import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import type { CatalogEntry, Manifest } from '@autotranslate/core';
import fg from 'fast-glob';
import { transformAutoWrap } from '../../auto-transform';
import { writeChunkedCatalog, writeManifest } from '../../catalog';
import { writeCatalogModule } from '../../catalog-module';
import type { ExtractResult, ResolvedConfig } from '../../types';
import { extractFile } from './extractor';

/**
 * Scan source files and build the source-locale catalog in memory.
 * Pure read - no writes to disk.
 */
export async function collectExtraction(resolved: ResolvedConfig): Promise<ExtractResult> {
  const { cwd, config } = resolved;
  const files = await fg(config.content, {
    cwd,
    absolute: true,
    ignore: ['**/node_modules/**', `${config.outDir}/**`],
  });

  const messages: Record<string, CatalogEntry> = {};
  const manifest: Manifest = {};

  for (const absolute of files) {
    let source = await readFile(absolute, 'utf8');
    const display = relative(cwd, absolute);
    // In auto mode the extractor sees the same code the bundler transform
    // emits, so extraction and compiled output agree key-for-key.
    if (config.mode === 'auto') {
      source = transformAutoWrap(source, { filename: display }).code;
    }
    const result = extractFile(display, source, {
      includeAutoCopy: config.mode === 'auto',
    });
    Object.assign(messages, result.messages);
    for (const [key, meta] of Object.entries(result.manifest)) {
      manifest[key] = mergeMeta(manifest[key], meta);
    }
  }

  return { source: messages, manifest, fileCount: files.length };
}

/** Scan source files, build the source-locale catalog, persist as chunks. */
export async function extract(resolved: ResolvedConfig): Promise<ExtractResult> {
  const { config, outDir } = resolved;
  const result = await collectExtraction(resolved);

  await writeChunkedCatalog(outDir, config.source, result.source, result.manifest);
  await writeManifest(outDir, result.manifest);
  await writeCatalogModule(outDir, config.source, [config.source, ...config.targets]);

  return result;
}

function mergeMeta(
  existing: Manifest[string] | undefined,
  incoming: Manifest[string] | undefined,
): Manifest[string] {
  if (!existing) return incoming ?? {};
  if (!incoming) return existing;
  const occurrences = [...(existing.occurrences ?? []), ...(incoming.occurrences ?? [])];
  return {
    ...existing,
    ...incoming,
    ...(occurrences.length > 0 ? { occurrences } : {}),
  };
}
