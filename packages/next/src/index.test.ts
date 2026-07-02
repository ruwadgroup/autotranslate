import { buildCatalog } from '@autotranslate/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCatalogCache, getT } from './index';
import type { CatalogModule } from './types';

afterEach(() => {
  clearCatalogCache();
});

function makeFakeModule(catalogs: Record<string, Record<string, string>>): CatalogModule & {
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(async (locale: string) => buildCatalog(catalogs[locale] ?? {}));
  return {
    source: 'en',
    locales: Object.keys(catalogs) as ReadonlyArray<string>,
    loadCatalog: spy,
    spy,
  };
}

describe('getT - module path', () => {
  it('resolves translations via loadCatalog', async () => {
    const mod = makeFakeModule({ es: { Hi: 'Hola' } });
    const t = await getT('es', { module: mod });
    expect(t.t('Hi')).toBe('Hola');
  });

  it('memoizes: loadCatalog called once across two getT calls for the same locale', async () => {
    const mod = makeFakeModule({ es: { Hi: 'Hola' } });
    await getT('es', { module: mod });
    await getT('es', { module: mod });
    expect(mod.spy).toHaveBeenCalledTimes(1);
  });

  it('clearCatalogCache forces a fresh loadCatalog call', async () => {
    const mod = makeFakeModule({ es: { Hi: 'Hola' } });
    await getT('es', { module: mod });
    clearCatalogCache();
    await getT('es', { module: mod });
    expect(mod.spy).toHaveBeenCalledTimes(2);
  });

  it('loads the fallback locale through the same module', async () => {
    const mod = makeFakeModule({ es: {}, en: { Hello: 'Hello' } });
    const t = await getT('es', { module: mod, fallback: 'en' });
    expect(t.t('Hello')).toBe('Hello');
  });

  it('memoizes the fallback locale independently', async () => {
    const mod = makeFakeModule({ es: {}, en: { Hello: 'Hello' } });
    await getT('es', { module: mod, fallback: 'en' });
    await getT('es', { module: mod, fallback: 'en' });
    expect(mod.spy).toHaveBeenCalledTimes(2);
  });
});

describe('getT - load callback path', () => {
  it('accepts a custom loader (no fs)', async () => {
    const t = await getT('es', {
      load: (locale) => (locale === 'es' ? buildCatalog({ Hi: 'Hola' }) : {}),
    });
    expect(t.t('Hi')).toBe('Hola');
  });

  it('returns the key on miss when no fallback is configured', async () => {
    const t = await getT('es', { load: () => ({}) });
    expect(t.t('Untranslated')).toBe('Untranslated');
  });
});

describe('getT - error cases', () => {
  it('throws a guidance error when neither module nor load is provided', async () => {
    await expect(getT('es', {})).rejects.toThrow(/import \* as catalogModule/);
  });

  it('guidance error names the generated module path', async () => {
    await expect(getT('es')).rejects.toThrow(/outDir.*index\.ts|index\.ts.*outDir/);
  });

  it('guidance error tells the user to pass { module }', async () => {
    await expect(getT('es')).rejects.toThrow(/\{ module: catalogModule \}/);
  });
});
