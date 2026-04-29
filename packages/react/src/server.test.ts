import { buildCatalog } from '@autotranslate/core';
import { describe, expect, it } from 'vitest';
import { createTranslator, getT } from './server';

describe('createTranslator (server)', () => {
  it('returns a translator bound to the catalog', () => {
    const t = createTranslator({
      locale: 'es',
      catalog: buildCatalog({ Hi: 'Hola' }),
    });
    expect(t.t('Hi')).toBe('Hola');
  });
});

describe('getT', () => {
  it('awaits the catalog loader', async () => {
    const t = await getT('es', async () => buildCatalog({ Hi: 'Hola' }));
    expect(t.t('Hi')).toBe('Hola');
  });

  it('uses the fallback loader when provided', async () => {
    const t = await getT(
      'es',
      () => ({}),
      () => buildCatalog({ Hi: 'Hi' }),
    );
    expect(t.t('Hi')).toBe('Hi');
  });

  it('passes the locale to the loaders', async () => {
    let receivedLocale: string | undefined;
    await getT('fr', (locale) => {
      receivedLocale = locale;
      return {};
    });
    expect(receivedLocale).toBe('fr');
  });
});
