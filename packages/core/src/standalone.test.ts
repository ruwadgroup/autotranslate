import { describe, expect, it } from 'vitest';
import { buildCatalog, createTranslator } from './runtime';
import { bindTranslator, currentTranslator, t, withTranslator } from './standalone';

describe('standalone', () => {
  it('throws when no translator is bound', () => {
    expect(() => currentTranslator()).toThrow(/No active translator/);
  });

  it('runs the callback with the bound translator', () => {
    const translator = createTranslator({ locale: 'es', catalog: buildCatalog({ Hello: 'Hola' }) });
    const result = withTranslator(translator, () => t('Hello'));
    expect(result).toBe('Hola');
  });

  it('restores the previous binding on exit', () => {
    const fr = createTranslator({ locale: 'fr', catalog: buildCatalog({ Hello: 'Bonjour' }) });
    const es = createTranslator({ locale: 'es', catalog: buildCatalog({ Hello: 'Hola' }) });
    withTranslator(fr, () => {
      expect(t('Hello')).toBe('Bonjour');
      withTranslator(es, () => {
        expect(t('Hello')).toBe('Hola');
      });
      expect(t('Hello')).toBe('Bonjour');
    });
    expect(() => currentTranslator()).toThrow();
  });

  it('isolates concurrent async chains via AsyncLocalStorage', async () => {
    const fr = createTranslator({ locale: 'fr', catalog: buildCatalog({ Hello: 'Bonjour' }) });
    const es = createTranslator({ locale: 'es', catalog: buildCatalog({ Hello: 'Hola' }) });
    const [a, b] = await Promise.all([
      withTranslator(fr, async () => {
        await new Promise((r) => setTimeout(r, 1));
        return t('Hello');
      }),
      withTranslator(es, async () => {
        await new Promise((r) => setTimeout(r, 1));
        return t('Hello');
      }),
    ]);
    expect(a).toBe('Bonjour');
    expect(b).toBe('Hola');
  });

  it('bindTranslator sets the translator for the rest of the chain', () => {
    const translator = createTranslator({ locale: 'es', catalog: buildCatalog({ Hi: 'Hola' }) });
    withTranslator(createTranslator({ locale: 'en', catalog: {} }), () => {
      bindTranslator(translator);
      expect(t('Hi')).toBe('Hola');
    });
  });

  it('forwards ICU params', () => {
    const translator = createTranslator({
      locale: 'en',
      catalog: buildCatalog({ greeting: 'Hello, {name}!' }),
    });
    expect(withTranslator(translator, () => t('greeting', { name: 'Ada' }))).toBe('Hello, Ada!');
  });
});
