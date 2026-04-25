import type { StructuredMessage } from '@autotranslate/core';
import { describe, expect, it } from 'vitest';
import { icuToTree, treeToICU } from './tree-icu';

describe('treeToICU', () => {
  it('serializes text and variables', () => {
    const tree: StructuredMessage = [
      { type: 'text', value: 'Hello, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '!' },
    ];
    expect(treeToICU(tree)).toBe('Hello, {name}!');
  });

  it('serializes plural branches', () => {
    const tree: StructuredMessage = [
      {
        type: 'plural',
        name: 'count',
        forms: {
          one: [{ type: 'text', value: '1 item' }],
          other: [{ type: 'text', value: '# items' }],
        },
      },
    ];
    expect(treeToICU(tree)).toBe("{count, plural, one {1 item} other {'#' items}}");
  });

  it('serializes tag wrappers', () => {
    const tree: StructuredMessage = [
      { type: 'text', value: 'See ' },
      { type: 'tag', tag: 'a', children: [{ type: 'text', value: 'docs' }] },
    ];
    expect(treeToICU(tree)).toBe('See <a>docs</a>');
  });

  it('escapes ICU specials in text', () => {
    const tree: StructuredMessage = [{ type: 'text', value: "It's {literal}" }];
    expect(treeToICU(tree)).toBe("It''s '{'literal'}'");
  });
});

describe('icuToTree', () => {
  it('parses text and variables', () => {
    expect(icuToTree('Hello, {name}!')).toEqual([
      { type: 'text', value: 'Hello, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '!' },
    ]);
  });

  it('parses plural branches', () => {
    const out = icuToTree('{count, plural, one {1 item} other {many items}}');
    expect(out).toEqual([
      {
        type: 'plural',
        name: 'count',
        forms: {
          one: [{ type: 'text', value: '1 item' }],
          other: [{ type: 'text', value: 'many items' }],
        },
      },
    ]);
  });

  it('parses tag wrappers', () => {
    expect(icuToTree('See <a>docs</a>')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'tag', tag: 'a', children: [{ type: 'text', value: 'docs' }] },
    ]);
  });

  it('merges adjacent text after escaping round-trips', () => {
    const tree: StructuredMessage = [
      { type: 'text', value: 'a' },
      { type: 'text', value: 'b' },
    ];
    expect(icuToTree(treeToICU(tree))).toEqual([{ type: 'text', value: 'ab' }]);
  });
});

describe('tree ↔ ICU round-trip', () => {
  it('is lossless for the common shapes', () => {
    const tree: StructuredMessage = [
      { type: 'text', value: 'Hello, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '. ' },
      {
        type: 'plural',
        name: 'count',
        forms: {
          one: [{ type: 'text', value: 'You have 1 message.' }],
          other: [
            { type: 'text', value: 'You have ' },
            { type: 'var', name: 'count' },
            { type: 'text', value: ' messages.' },
          ],
        },
      },
    ];
    expect(icuToTree(treeToICU(tree))).toEqual(tree);
  });
});
