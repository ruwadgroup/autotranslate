import { describe, expect, it, vi } from 'vitest';
import { canonicalKey, type StructuredMessage } from './jsx-tree';
import { createTranslator } from './runtime';

describe('createTranslator', () => {
  it('returns translated strings', () => {
    const t = createTranslator({
      locale: 'es',
      catalog: { 'Sign out': 'Cerrar sesión' },
    });
    expect(t.t('Sign out')).toBe('Cerrar sesión');
  });

  it('falls back to the source catalog on miss', () => {
    const t = createTranslator({
      locale: 'es',
      catalog: { Hello: 'Hola' },
      fallback: { Goodbye: 'Goodbye' },
    });
    expect(t.t('Goodbye')).toBe('Goodbye');
  });

  it('returns the key when both catalog and fallback miss', () => {
    const t = createTranslator({ locale: 'es', catalog: {} });
    expect(t.t('Untranslated')).toBe('Untranslated');
  });

  it('invokes onMissing when configured', () => {
    const onMissing = vi.fn(() => 'CUSTOM');
    const t = createTranslator({
      locale: 'es',
      catalog: {},
      onMissing,
    });
    expect(t.t('Whatever')).toBe('CUSTOM');
    expect(onMissing).toHaveBeenCalledWith('Whatever', 'es');
  });

  it('formats ICU parameters', () => {
    const t = createTranslator({
      locale: 'en',
      catalog: { greeting: 'Hello, {name}!' },
    });
    expect(t.t('greeting', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  it('renders structured messages to text via t()', () => {
    const tree: StructuredMessage = [
      { type: 'text', value: 'Hello, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '!' },
    ];
    const key = canonicalKey(tree);
    const t = createTranslator({
      locale: 'en',
      catalog: { [key]: tree },
    });
    expect(t.t(key, { name: 'Ada' })).toBe('Hello, Ada!');
  });

  it('returns structured trees from tree() and undefined for plain strings', () => {
    const tree: StructuredMessage = [{ type: 'text', value: 'hi' }];
    const t = createTranslator({
      locale: 'en',
      catalog: { tree: tree, str: 'plain' },
    });
    expect(t.tree('tree')).toEqual(tree);
    expect(t.tree('str')).toBeUndefined();
    expect(t.tree('missing')).toBeUndefined();
  });

  it('exposes the raw catalog entry', () => {
    const tree: StructuredMessage = [{ type: 'text', value: 'hi' }];
    const t = createTranslator({
      locale: 'en',
      catalog: { tree, str: 'plain' },
    });
    expect(t.raw('tree')).toBe(tree);
    expect(t.raw('str')).toBe('plain');
    expect(t.raw('missing')).toBeUndefined();
  });
});
