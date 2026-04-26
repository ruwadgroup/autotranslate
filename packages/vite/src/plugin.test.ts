import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import autotranslate, { VIRTUAL_MODULE_ID } from './index';

const RESOLVED = `\0${VIRTUAL_MODULE_ID}`;

async function fixture(catalogs: Record<string, Record<string, unknown>>): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-vite-'));
  const outDir = join(cwd, '.translations');
  await mkdir(outDir, { recursive: true });
  for (const [locale, data] of Object.entries(catalogs)) {
    await writeFile(join(outDir, `${locale}.json`), JSON.stringify(data));
  }
  return cwd;
}

// Vite plugin hooks are typed as object-or-function in newer versions; in our
// plugin they're always functions, so we just narrow once and call directly.
function asFn<H extends keyof Plugin>(
  plugin: Plugin,
  hook: H,
  // biome-ignore lint/suspicious/noExplicitAny: hook signature varies per name; tests narrow at the call site.
): (...args: any[]) => unknown {
  const value = plugin[hook];
  if (typeof value !== 'function') {
    throw new Error(`expected hook ${String(hook)} to be a function`);
  }
  return value as (...args: unknown[]) => unknown;
}

describe('@autotranslate/vite', () => {
  it('resolves the virtual module id', () => {
    const plugin = autotranslate();
    expect(asFn(plugin, 'resolveId')(VIRTUAL_MODULE_ID)).toBe(RESOLVED);
  });

  it('returns undefined for non-virtual ids', () => {
    const plugin = autotranslate();
    expect(asFn(plugin, 'resolveId')('react')).toBeUndefined();
    expect(asFn(plugin, 'resolveId')('./local')).toBeUndefined();
  });

  it('emits a virtual module that exports the loaded catalogs', async () => {
    const cwd = await fixture({
      en: { Hi: 'Hi' },
      es: { Hi: 'Hola' },
    });
    const plugin = autotranslate({ cwd, source: 'en', locales: ['en', 'es'] });
    const code = (await asFn(plugin, 'load')(RESOLVED)) as string;
    expect(code).toContain('"en":{"Hi":"Hi"}');
    expect(code).toContain('"es":{"Hi":"Hola"}');
    expect(code).toContain('export const source = "en"');
    expect(code).toContain('export const locales = ["en","es"]');
  });

  it('returns empty objects for locales whose JSON file is missing', async () => {
    const cwd = await fixture({});
    const plugin = autotranslate({ cwd, source: 'en', locales: ['en', 'fr'] });
    const code = (await asFn(plugin, 'load')(RESOLVED)) as string;
    expect(code).toContain('"en":{}');
    expect(code).toContain('"fr":{}');
  });

  it('honors the inline-config option without disk lookup', async () => {
    const cwd = await fixture({
      en: { Hi: 'Hi' },
      es: { Hi: 'Hola' },
    });
    const plugin = autotranslate({
      cwd,
      config: {
        source: 'en',
        targets: ['es'],
        content: ['x'],
        outDir: '.translations',
        provider: { name: 'stub' },
        concurrency: 8,
      },
    });
    const code = (await asFn(plugin, 'load')(RESOLVED)) as string;
    expect(code).toContain('"en":{"Hi":"Hi"}');
    expect(code).toContain('"es":{"Hi":"Hola"}');
  });

  it('skips load for unrelated ids', async () => {
    const plugin = autotranslate();
    expect(await asFn(plugin, 'load')('react')).toBeUndefined();
  });
});
