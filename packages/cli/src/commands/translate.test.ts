import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseConfig } from '@autotranslate/core/config';
import { createStubProvider } from '@autotranslate/providers/stub';
import { describe, expect, it } from 'vitest';
import { readChunkedCatalog, writeChunkedCatalog, writeManifest } from '../catalog';
import type { ResolvedConfig } from '../types';
import { translate } from './translate';

const FIXTURE_FILE = 'src/Component.tsx';

async function setupFixture(
  source: Record<string, string>,
  overrides: Record<string, Record<string, string>> = {},
): Promise<{ resolved: ResolvedConfig; cwd: string; outDir: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-translate-'));
  const outDir = join(cwd, '.translations');
  const manifest = Object.fromEntries(
    Object.keys(source).map((k) => [k, { occurrences: [{ file: FIXTURE_FILE, line: 1 }] }]),
  );
  await writeChunkedCatalog(outDir, 'en', source, manifest);
  await writeManifest(outDir, manifest);
  const config = parseConfig({
    targets: ['es'],
    content: ['src/**/*.tsx'],
    provider: { name: 'stub' },
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
  });
  return { resolved: { cwd, config, outDir }, cwd, outDir };
}

describe('translate', () => {
  it('writes translated catalogs and a cache chunk', async () => {
    const { resolved, outDir } = await setupFixture({
      'Sign out': 'Sign out',
      greeting: 'Hello, {name}!',
    });
    const result = await translate(resolved, { provider: createStubProvider() });
    expect(result.stats.es).toEqual({ fetched: 2, cached: 0, overridden: 0 });
    expect(await readChunkedCatalog(outDir, 'es')).toEqual({
      'Sign out': 'Sign out',
      greeting: 'Hello, {name}!',
    });
  });

  it('skips already-cached entries on a second run via chunk-hash short-circuit', async () => {
    const { resolved } = await setupFixture({
      'Sign out': 'Sign out',
      greeting: 'Hello, {name}!',
    });
    const provider = createStubProvider();
    await translate(resolved, { provider });
    const second = await translate(resolved, { provider });
    expect(second.stats.es).toEqual({ fetched: 0, cached: 2, overridden: 0 });
  });

  it('re-translates only changed strings when the source content changes', async () => {
    const { resolved, outDir } = await setupFixture({
      'Sign out': 'Sign out',
      greeting: 'Hello, {name}!',
    });
    const provider = createStubProvider();
    await translate(resolved, { provider });
    await writeChunkedCatalog(
      outDir,
      'en',
      { 'Sign out': 'Log out', greeting: 'Hello, {name}!' },
      {
        'Sign out': { occurrences: [{ file: FIXTURE_FILE, line: 1 }] },
        greeting: { occurrences: [{ file: FIXTURE_FILE, line: 2 }] },
      },
    );
    const second = await translate(resolved, { provider });
    expect(second.stats.es).toEqual({ fetched: 1, cached: 1, overridden: 0 });
  });

  it('applies per-locale overrides', async () => {
    const { resolved, outDir } = await setupFixture(
      { 'Sign out': 'Sign out' },
      { es: { 'Sign out': 'Cerrar sesión' } },
    );
    const result = await translate(resolved, { provider: createStubProvider() });
    expect(result.stats.es).toEqual({ fetched: 0, cached: 0, overridden: 1 });
    expect(await readChunkedCatalog(outDir, 'es')).toEqual({ 'Sign out': 'Cerrar sesión' });
  });

  it('honors the `only` filter', async () => {
    const { resolved } = await setupFixture({ Hi: 'Hi' });
    const config = parseConfig({
      targets: ['es', 'fr'],
      content: ['src/**/*.tsx'],
      provider: { name: 'stub' },
    });
    const result = await translate(
      { ...resolved, config },
      { provider: createStubProvider(), only: ['es'] },
    );
    expect(Object.keys(result.stats)).toEqual(['es']);
  });
});
