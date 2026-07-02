import { describe, expect, it, vi } from 'vitest';
import { canonicalKey, type StructuredMessage } from './jsx-tree';
import { applyContextToKey, CONTEXT_KEY_SEPARATOR, sourceKey } from './key';
import { buildCatalog, createTranslator } from './translator';

describe('createTranslator', () => {
  it('returns translated strings', () => {
    const t = createTranslator({
      locale: 'es',
      catalog: buildCatalog({ 'Sign out': 'Cerrar sesión' }),
    });
    expect(t.t('Sign out')).toBe('Cerrar sesión');
  });

  it('falls back to the source catalog on miss', () => {
    const t = createTranslator({
      locale: 'es',
      catalog: buildCatalog({ Hello: 'Hola' }),
      fallback: buildCatalog({ Goodbye: 'Goodbye' }),
    });
    expect(t.t('Goodbye')).toBe('Goodbye');
  });

  it('returns the key when both catalog and fallback miss', () => {
    const t = createTranslator({ locale: 'es', catalog: {} });
    expect(t.t('Untranslated')).toBe('Untranslated');
  });

  it('formats ICU on the source key when the catalog misses', () => {
    const t = createTranslator({ locale: 'en', catalog: {} });
    expect(t.t('Hello, {name}!', { name: 'Ada' })).toBe('Hello, Ada!');
    expect(t.t('{count, plural, one {# item} other {# items}}', { count: 2 })).toBe('2 items');
  });

  it('returns the key on every miss (default-fallback path)', () => {
    const t = createTranslator({ locale: 'es', catalog: {} });
    expect(t.t('Untranslated')).toBe('Untranslated');
    expect(t.t('Untranslated')).toBe('Untranslated');
  });

  it('invokes onMissing instead of the default path when supplied', () => {
    const onMissing = vi.fn(() => 'X');
    const t = createTranslator({ locale: 'es', catalog: {}, onMissing });
    expect(t.t('Whatever')).toBe('X');
    expect(onMissing).toHaveBeenCalled();
  });

  it('invokes onMissing when configured', () => {
    const onMissing = vi.fn(() => 'CUSTOM');
    const t = createTranslator({
      locale: 'es',
      catalog: {},
      onMissing,
    });
    expect(t.t('Whatever')).toBe('CUSTOM');
    expect(onMissing).toHaveBeenCalledWith(sourceKey('Whatever'), 'es');
  });

  it('formats ICU parameters', () => {
    const t = createTranslator({
      locale: 'en',
      catalog: buildCatalog({ greeting: 'Hello, {name}!' }),
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
    const treeKey = canonicalKey(tree);
    const t = createTranslator({
      locale: 'en',
      catalog: { [treeKey]: tree, [sourceKey('str')]: 'plain' },
    });
    expect(t.tree(treeKey)).toEqual(tree);
    expect(t.tree('str')).toBeUndefined();
    expect(t.tree('missing')).toBeUndefined();
  });

  it('exposes the raw catalog entry', () => {
    const tree: StructuredMessage = [{ type: 'text', value: 'hi' }];
    const treeKey = canonicalKey(tree);
    const t = createTranslator({
      locale: 'en',
      catalog: { [treeKey]: tree, [sourceKey('str')]: 'plain' },
    });
    expect(t.raw(treeKey)).toBe(tree);
    expect(t.raw('str')).toBe('plain');
    expect(t.raw('missing')).toBeUndefined();
  });

  it('disambiguates by $context option', () => {
    const t = createTranslator({
      locale: 'es',
      catalog: {
        [sourceKey('Submit')]: 'Enviar',
        [sourceKey('Submit', 'navbar')]: 'Enviar (nav)',
      },
    });
    expect(t.t('Submit')).toBe('Enviar');
    expect(t.t('Submit', { $context: 'navbar' })).toBe('Enviar (nav)');
    // Falls back to the bare entry when no context-specific translation exists.
    expect(t.t('Submit', { $context: 'unmapped' })).toBe('Enviar');
  });

  it('strips reserved $-prefixed options before ICU formatting', () => {
    const t = createTranslator({
      locale: 'en',
      catalog: buildCatalog({ greeting: 'Hello, {name}!' }),
    });
    expect(
      t.t('greeting', { name: 'Ada', $context: 'home', $maxChars: 30, $description: 'hi' }),
    ).toBe('Hello, Ada!');
  });
});

describe('applyContextToKey', () => {
  it('appends the context with the separator', () => {
    expect(applyContextToKey('Submit', 'navbar')).toBe(`Submit${CONTEXT_KEY_SEPARATOR}navbar`);
  });

  it('returns the bare key when context is empty / undefined', () => {
    expect(applyContextToKey('Submit', undefined)).toBe('Submit');
    expect(applyContextToKey('Submit', '')).toBe('Submit');
  });
});

describe('sourceKey', () => {
  it('produces a stable 12-hex hash', () => {
    const key = sourceKey('Sign out');
    expect(key).toHaveLength(12);
    expect(key).toMatch(/^[0-9a-f]{12}$/);
    expect(sourceKey('Sign out')).toBe(key);
  });

  it('mixes context into the hash', () => {
    expect(sourceKey('Submit')).not.toBe(sourceKey('Submit', 'navbar'));
  });
});

describe('buildCatalog', () => {
  it('hashes literal keys; passes tree keys through', () => {
    const catalog = buildCatalog({
      Hello: 'Hola',
      'Sign out': 'Cerrar sesión',
      't.aaaabbbbcccc': 'unchanged',
    });
    expect(catalog[sourceKey('Hello')]).toBe('Hola');
    expect(catalog[sourceKey('Sign out')]).toBe('Cerrar sesión');
    expect(catalog['t.aaaabbbbcccc']).toBe('unchanged');
  });
});
