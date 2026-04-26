import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { createStubProvider } from '@autotranslate/providers/stub';
import { describe, expect, it } from 'vitest';
import type { ResolvedConfig } from '../types';
import { translate } from './translate';

async function makeFixture(): Promise<{
  resolved: ResolvedConfig;
  cwd: string;
  outDir: string;
}> {
  const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-translate-'));
  const outDir = join(cwd, '.translations');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, 'en.json'),
    JSON.stringify(
      {
        'Sign out': 'Sign out',
        greeting: 'Hello, {name}!',
      },
      null,
      2,
    ),
  );
  const config = parseConfig({
    targets: ['es'],
    content: ['src/**/*.tsx'],
    provider: { name: 'stub' },
  });
  return { resolved: { cwd, config, outDir }, cwd, outDir };
}

describe('translate', () => {
  it('writes translated catalogs and a cache file', async () => {
    const { resolved, outDir } = await makeFixture();
    const result = await translate(resolved, { provider: createStubProvider() });
    expect(result.stats.es).toEqual({ fetched: 2, cached: 0, overridden: 0 });
    const targetPath = resolve(outDir, 'es.json');
    expect(JSON.parse(await readFile(targetPath, 'utf8'))).toEqual({
      'Sign out': 'Sign out',
      greeting: 'Hello, {name}!',
    });
  });

  it('skips already-cached entries on a second run', async () => {
    const { resolved } = await makeFixture();
    const provider = createStubProvider();
    await translate(resolved, { provider });
    const second = await translate(resolved, { provider });
    expect(second.stats.es).toEqual({ fetched: 0, cached: 2, overridden: 0 });
  });

  it('re-translates when the source content changes', async () => {
    const { resolved, outDir } = await makeFixture();
    const provider = createStubProvider();
    await translate(resolved, { provider });
    await writeFile(
      join(outDir, 'en.json'),
      JSON.stringify({ 'Sign out': 'Log out', greeting: 'Hello, {name}!' }, null, 2),
    );
    const second = await translate(resolved, { provider });
    expect(second.stats.es).toEqual({ fetched: 1, cached: 1, overridden: 0 });
  });

  it('applies per-locale overrides', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-translate-'));
    const outDir = join(cwd, '.translations');
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'en.json'), JSON.stringify({ 'Sign out': 'Sign out' }, null, 2));
    const config = parseConfig({
      targets: ['es'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
      overrides: { es: { 'Sign out': 'Cerrar sesión' } },
    });
    const result = await translate({ cwd, config, outDir }, { provider: createStubProvider() });
    expect(result.stats.es).toEqual({ fetched: 0, cached: 0, overridden: 1 });
    expect(JSON.parse(await readFile(join(outDir, 'es.json'), 'utf8'))).toEqual({
      'Sign out': 'Cerrar sesión',
    });
  });

  it('honors the `only` filter', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-translate-'));
    const outDir = join(cwd, '.translations');
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, 'en.json'), JSON.stringify({ Hi: 'Hi' }, null, 2));
    const config = parseConfig({
      targets: ['es', 'fr'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const result = await translate(
      { cwd, config, outDir },
      {
        provider: createStubProvider(),
        only: ['es'],
      },
    );
    expect(Object.keys(result.stats)).toEqual(['es']);
  });
});
