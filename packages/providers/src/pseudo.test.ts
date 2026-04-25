import type { StructuredMessage } from '@autotranslate/core';
import { describe, expect, it } from 'vitest';
import { pseudoLocalize, pseudoLocalizeTree } from './pseudo';

describe('pseudoLocalize', () => {
  it('wraps in expansion brackets', () => {
    expect(pseudoLocalize('hello')).toBe('⟦ ĥéĺĺó ⟧');
  });

  it('preserves ICU placeholders verbatim', () => {
    expect(pseudoLocalize('Hello, {name}!')).toBe('⟦ Ĥéĺĺó, {name}! ⟧');
  });

  it('preserves nested ICU plural blocks', () => {
    const out = pseudoLocalize('{count, plural, one {item} other {items}}');
    expect(out).toContain('{count, plural, one {item} other {items}}');
    expect(out.startsWith('⟦ ')).toBe(true);
    expect(out.endsWith(' ⟧')).toBe(true);
  });

  it('leaves non-Latin characters untouched', () => {
    expect(pseudoLocalize('你好')).toBe('⟦ 你好 ⟧');
  });
});

describe('pseudoLocalizeTree', () => {
  it('accents text leaves and preserves structure', () => {
    const tree: StructuredMessage = [
      { type: 'text', value: 'Hello, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '!' },
    ];
    const out = pseudoLocalizeTree(tree);
    expect(out[0]).toEqual({ type: 'text', value: '⟦ Ĥéĺĺó,  ⟧' });
    expect(out[1]).toEqual({ type: 'var', name: 'name' });
    expect(out[2]).toEqual({ type: 'text', value: '⟦ ! ⟧' });
  });

  it('walks plural arms recursively', () => {
    const tree: StructuredMessage = [
      {
        type: 'plural',
        name: 'count',
        forms: {
          one: [{ type: 'text', value: 'item' }],
          other: [{ type: 'text', value: 'items' }],
        },
      },
    ];
    const out = pseudoLocalizeTree(tree);
    const plural = out[0];
    if (plural?.type !== 'plural') throw new Error('expected plural node');
    expect(plural.forms.one?.[0]).toEqual({ type: 'text', value: '⟦ íţéɱ ⟧' });
    expect(plural.forms.other?.[0]).toEqual({ type: 'text', value: '⟦ íţéɱš ⟧' });
  });

  it('walks tag wrappers recursively', () => {
    const tree: StructuredMessage = [
      { type: 'tag', tag: 'a', children: [{ type: 'text', value: 'docs' }] },
    ];
    const out = pseudoLocalizeTree(tree);
    const tag = out[0];
    if (tag?.type !== 'tag') throw new Error('expected tag node');
    expect(tag.children[0]).toEqual({ type: 'text', value: '⟦ đóçš ⟧' });
  });
});
