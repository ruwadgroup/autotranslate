import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clearCatalogCache, getT } from './index';

describe('getT', () => {
  it('reads catalogs from the default fs loader', async () => {
    clearCatalogCache();
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-next-getT-'));
    const outDir = '.translations';
    await mkdir(join(cwd, outDir), { recursive: true });
    await writeFile(
      join(cwd, outDir, 'es.json'),
      JSON.stringify({ Hi: 'Hola', greeting: 'Hola, {name}!' }),
    );
    const t = await getT('es', { cwd, outDir });
    expect(t.t('Hi')).toBe('Hola');
    expect(t.t('greeting', { name: 'Ada' })).toBe('Hola, Ada!');
  });

  it('falls back to the source-locale catalog when configured', async () => {
    clearCatalogCache();
    const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-next-getT-'));
    const outDir = '.translations';
    await mkdir(join(cwd, outDir), { recursive: true });
    await writeFile(join(cwd, outDir, 'en.json'), JSON.stringify({ Hi: 'Hi' }));
    await writeFile(join(cwd, outDir, 'es.json'), JSON.stringify({}));
    const t = await getT('es', { cwd, outDir, fallback: 'en' });
    expect(t.t('Hi')).toBe('Hi');
  });

  it('accepts a custom loader (no fs)', async () => {
    const t = await getT('es', {
      load: (locale) => (locale === 'es' ? { Hi: 'Hola' } : {}),
    });
    expect(t.t('Hi')).toBe('Hola');
  });

  it('returns the key on miss when no fallback is configured', async () => {
    const t = await getT('es', { load: () => ({}) });
    expect(t.t('Untranslated')).toBe('Untranslated');
  });
});
