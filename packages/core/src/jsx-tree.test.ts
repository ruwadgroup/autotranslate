import { describe, expect, it } from 'vitest';
import {
  canonicalize,
  canonicalKey,
  isStructured,
  type PluralNode,
  renderTreeToString,
  type StructuredMessage,
  type TagNode,
  type TextNode,
  TREE_KEY_PREFIX,
  type VarNode,
} from './jsx-tree';

const text = (value: string): TextNode => ({ type: 'text', value });
const variable = (name: string): VarNode => ({ type: 'var', name });
const tag = (name: string, children: StructuredMessage): TagNode => ({
  type: 'tag',
  tag: name,
  children,
});

describe('canonicalize', () => {
  it('serializes a flat tree deterministically', () => {
    const tree: StructuredMessage = [text('Hello, '), variable('name'), text('!')];
    expect(canonicalize(tree)).toBe(
      '[{"type":"text","value":"Hello, "},{"name":"name","type":"var"},{"type":"text","value":"!"}]',
    );
  });

  it('produces identical output for objects with different key insertion order', () => {
    const a: StructuredMessage = [{ type: 'var', name: 'x' }];
    const b: StructuredMessage = [{ name: 'x', type: 'var' } as VarNode];
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('walks nested tag children', () => {
    const tree: StructuredMessage = [
      text('Click '),
      tag('a', [text('here')]),
      text(' to continue'),
    ];
    expect(canonicalize(tree)).toContain('"tag":"a"');
    expect(canonicalize(tree)).toContain('"value":"here"');
  });
});

describe('canonicalKey', () => {
  it('starts with the t. prefix', () => {
    const key = canonicalKey([text('Hi')]);
    expect(key.startsWith(TREE_KEY_PREFIX)).toBe(true);
    expect(key).toHaveLength(TREE_KEY_PREFIX.length + 12);
  });

  it('is stable across calls', () => {
    const tree: StructuredMessage = [text('Hello, '), variable('name'), text('!')];
    expect(canonicalKey(tree)).toBe(canonicalKey(tree));
  });

  it('changes when content changes', () => {
    expect(canonicalKey([text('Hi')])).not.toBe(canonicalKey([text('Hello')]));
    expect(canonicalKey([variable('a')])).not.toBe(canonicalKey([variable('b')]));
  });
});

describe('isStructured', () => {
  it.each([
    [[], true],
    [[text('hi')], true],
    ['plain string', false],
    [null, false],
    [{ not: 'an array' }, false],
    [42, false],
  ])('isStructured(%j) === %s', (input, expected) => {
    expect(isStructured(input)).toBe(expected);
  });
});

describe('renderTreeToString', () => {
  it('renders text + variables', () => {
    const tree: StructuredMessage = [text('Hello, '), variable('name'), text('!')];
    expect(renderTreeToString(tree, 'en', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  it('shows the placeholder when a variable is missing', () => {
    const tree: StructuredMessage = [variable('name')];
    expect(renderTreeToString(tree, 'en', {})).toBe('{name}');
  });

  it('flattens tag wrappers to their children', () => {
    const tree: StructuredMessage = [text('See '), tag('a', [text('docs')])];
    expect(renderTreeToString(tree, 'en', {})).toBe('See docs');
  });

  it('selects the right plural form and substitutes #', () => {
    const plural: PluralNode = {
      type: 'plural',
      name: 'count',
      forms: {
        one: [text('1 item')],
        other: [text('# items')],
      },
    };
    const tree: StructuredMessage = [plural];
    expect(renderTreeToString(tree, 'en', { count: 1 })).toBe('1 item');
    expect(renderTreeToString(tree, 'en', { count: 5 })).toBe('5 items');
  });

  it('falls back to the other form for non-finite counts', () => {
    const plural: PluralNode = {
      type: 'plural',
      name: 'count',
      forms: { one: [text('1 item')], other: [text('# items')] },
    };
    const tree: StructuredMessage = [plural];
    expect(renderTreeToString(tree, 'en', {})).toBe(' items');
  });
});
