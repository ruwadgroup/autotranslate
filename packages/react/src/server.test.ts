import { describe, expect, it } from 'vitest';
import { createTranslator, getT } from './server';

describe('createTranslator (server)', () => {
  it('returns a translator bound to the catalog', () => {
    const t = createTranslator({
      locale: 'es',
      catalog: { Hi: 'Hola' },
    });
    expect(t.t('Hi')).toBe('Hola');
  });
});

describe('getT', () => {
  it('awaits the catalog loader', async () => {
    const t = await getT('es', async () => ({ Hi: 'Hola' }));
    expect(t.t('Hi')).toBe('Hola');
  });

  it('uses the fallback loader when provided', async () => {
    const t = await getT(
      'es',
      () => ({}),
      () => ({ Hi: 'Hi' }),
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
