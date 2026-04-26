import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearCatalogCache, fsCatalogLoader } from './catalog-loader';

afterEach(() => {
  clearCatalogCache();
});

async function fixture(catalogs: Record<string, Record<string, unknown>>): Promise<{
  cwd: string;
  outDir: string;
}> {
  const cwd = await mkdtemp(join(tmpdir(), 'autotranslate-next-loader-'));
  const outDir = '.translations';
  await mkdir(join(cwd, outDir), { recursive: true });
  for (const [locale, data] of Object.entries(catalogs)) {
    await writeFile(join(cwd, outDir, `${locale}.json`), JSON.stringify(data));
  }
  return { cwd, outDir };
}

describe('fsCatalogLoader', () => {
  it('reads JSON catalogs from disk', async () => {
    const { cwd, outDir } = await fixture({ es: { Hi: 'Hola' } });
    const load = fsCatalogLoader(cwd, outDir);
    expect(await load('es')).toEqual({ Hi: 'Hola' });
  });

  it('returns an empty object when the catalog file is missing', async () => {
    const { cwd, outDir } = await fixture({});
    const load = fsCatalogLoader(cwd, outDir);
    expect(await load('fr')).toEqual({});
  });

  it('memoizes per (cwd, outDir, locale)', async () => {
    const { cwd, outDir } = await fixture({ es: { Hi: 'Hola' } });
    const load = fsCatalogLoader(cwd, outDir);
    const first = await load('es');
    // Mutate the underlying file. A non-memoized loader would pick this up;
    // the memoized one still returns the original payload.
    await writeFile(join(cwd, outDir, 'es.json'), JSON.stringify({ Hi: 'changed' }));
    const second = await load('es');
    expect(second).toEqual(first);
    expect(second).toEqual({ Hi: 'Hola' });
  });

  it('clearCatalogCache forces a fresh read', async () => {
    const { cwd, outDir } = await fixture({ es: { Hi: 'Hola' } });
    const load = fsCatalogLoader(cwd, outDir);
    await load('es');
    await writeFile(join(cwd, outDir, 'es.json'), JSON.stringify({ Hi: 'changed' }));
    clearCatalogCache();
    expect(await load('es')).toEqual({ Hi: 'changed' });
  });
});
