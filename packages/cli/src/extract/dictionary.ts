import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import type { CatalogEntry, Manifest } from '@autotranslate/core';
import { createJiti } from 'jiti';

export interface DictionaryExtraction {
  readonly messages: Record<string, CatalogEntry>;
  readonly manifest: Manifest;
}

/**
 * Load a user-supplied dictionary and flatten its default-export tree into
 * `dot.path` keys. Accepts `.ts` / `.mts` / `.js` / `.mjs` / `.json`.
 */
export async function extractDictionary(
  cwd: string,
  dictionaryPath: string,
): Promise<DictionaryExtraction> {
  const absolute = isAbsolute(dictionaryPath) ? dictionaryPath : resolve(cwd, dictionaryPath);
  if (!existsSync(absolute)) {
    throw new Error(`Dictionary file not found: ${absolute}`);
  }
  const mod = await loadModule(absolute);
  const root = pickDefault(mod);
  if (!isPlainRecord(root)) {
    throw new Error(
      `Dictionary at ${absolute} must default-export a plain object; got ${typeof root}.`,
    );
  }

  const messages: Record<string, CatalogEntry> = {};
  const manifest: Manifest = {};
  const display = relative(cwd, absolute) || absolute;
  flatten(root, '', messages, manifest, display);
  return { messages, manifest };
}

function flatten(
  node: Record<string, unknown>,
  prefix: string,
  messages: Record<string, CatalogEntry>,
  manifest: Manifest,
  display: string,
): void {
  for (const key of Object.keys(node)) {
    const value = node[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      messages[path] = value;
      manifest[path] = { occurrences: [{ file: display, line: 0 }] };
    } else if (isPlainRecord(value)) {
      flatten(value, path, messages, manifest, display);
    }
  }
}

async function loadModule(path: string): Promise<unknown> {
  if (path.endsWith('.json')) {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(path, 'utf8'));
  }
  if (path.endsWith('.ts') || path.endsWith('.mts')) {
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    return jiti.import(path);
  }
  return import(/* @vite-ignore */ path);
}

function pickDefault(mod: unknown): unknown {
  if (mod === null || typeof mod !== 'object') return mod;
  const candidate = (mod as { default?: unknown }).default;
  return candidate ?? mod;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
