import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { createJiti } from 'jiti';
import type { ResolvedConfig } from './types';

const CANDIDATE_FILENAMES = [
  'autotranslate.config.ts',
  'autotranslate.config.mts',
  'autotranslate.config.js',
  'autotranslate.config.mjs',
];

export class ConfigNotFoundError extends Error {
  override readonly name = 'ConfigNotFoundError';
  constructor(cwd: string) {
    super(
      `No autotranslate.config.{ts,mts,js,mjs} found in ${cwd}. Run 'autotranslate init' to scaffold one.`,
    );
  }
}

/** Locate and load `autotranslate.config.{ts,mts,js,mjs}` from `cwd`. */
export async function loadConfig(cwd: string = process.cwd()): Promise<ResolvedConfig> {
  for (const name of CANDIDATE_FILENAMES) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    const mod = await loadModule(path);
    const raw = pickDefault(mod);
    const config = parseConfig(raw);
    return { cwd, config, outDir: resolve(cwd, config.outDir) };
  }
  throw new ConfigNotFoundError(cwd);
}

async function loadModule(path: string): Promise<unknown> {
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
