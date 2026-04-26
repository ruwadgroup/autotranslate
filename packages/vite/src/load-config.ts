import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AutotranslateConfig } from '@autotranslate/core/config';
import { parseConfig } from '@autotranslate/core/config';
import { createJiti } from 'jiti';

const CONFIG_FILES = [
  'autotranslate.config.ts',
  'autotranslate.config.mts',
  'autotranslate.config.js',
  'autotranslate.config.mjs',
];

/**
 * Locate and load `autotranslate.config.{ts,mts,js,mjs}` from `cwd`,
 * matching the CLI's loader. Returns `null` when no config is present —
 * the plugin treats that as "use the option-supplied or default values".
 */
export async function loadConfig(cwd: string): Promise<AutotranslateConfig | null> {
  for (const name of CONFIG_FILES) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    const mod = await loadModule(path);
    return parseConfig(pickDefault(mod));
  }
  return null;
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
