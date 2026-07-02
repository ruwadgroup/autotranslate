import { buildCatalog, type Catalog, type Locale } from '@autotranslate/core';
import { describe, expect, it, vi } from 'vitest';
import { type CatalogModule, withRequestTranslator } from './next';

const frCatalog = buildCatalog({
  'zod.invalid_type': 'Type invalide : {expected} attendu, {received} reçu',
});

// Minimal mock CatalogModule mirroring the generated .translations/index.ts shape.
function makeCatalogModule(catalogs: Record<string, Catalog>): CatalogModule {
  return {
    source: 'en' as Locale,
    locales: Object.keys(catalogs) as Locale[],
    loadCatalog: (locale: Locale) => Promise.resolve(catalogs[locale] ?? {}),
  };
}

describe('withRequestTranslator (module option)', () => {
  it('installs the error-map translator for the request locale and uses the module', async () => {
    const catalogModule = makeCatalogModule({ fr: frCatalog, en: {} });

    const result = await withRequestTranslator(
      () => 'ok' as const,
      // Provide locale directly so we don't need a real Next.js headers() call.
      { locale: 'fr', module: catalogModule },
    );

    expect(result).toBe('ok');
  });

  it('resolves catalog via loadCatalog on the module', async () => {
    const loadCatalogSpy = vi.fn((_locale: Locale) => Promise.resolve(frCatalog));
    const catalogModule: CatalogModule = {
      source: 'en',
      locales: ['en', 'fr'],
      loadCatalog: loadCatalogSpy,
    };

    await withRequestTranslator(() => {}, { locale: 'fr', module: catalogModule });

    expect(loadCatalogSpy).toHaveBeenCalledWith('fr');
  });
});

describe('withRequestTranslator (load option)', () => {
  it('accepts a custom loader function instead of a module', async () => {
    const load = vi.fn((_locale: Locale): Catalog => frCatalog);

    await withRequestTranslator(() => {}, { locale: 'fr', load });

    expect(load).toHaveBeenCalledWith('fr');
  });
});

describe('withRequestTranslator (error handling)', () => {
  it('throws a guidance error when neither module nor load is provided', async () => {
    await expect(withRequestTranslator(() => {})).rejects.toThrow(
      /withRequestTranslator requires either a catalog module or a custom loader/,
    );
  });

  it('guidance error mentions <outDir>/index.ts', async () => {
    await expect(withRequestTranslator(() => {})).rejects.toThrow(/index\.ts/);
  });
});
