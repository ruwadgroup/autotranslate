import type {
  BranchNode,
  PluralNode,
  StructuredMessage,
  TagNode,
  TextNode,
  TranslationNode,
  VarNode,
} from '@autotranslate/core';
import { parseICU } from '@autotranslate/core/icu';
import { mergeAdjacentText } from '@autotranslate/core/internal';
import {
  isPluralCategory,
  PLURAL_CATEGORIES,
  type PluralCategory,
} from '@autotranslate/core/locale';
import { type MessageFormatElement, TYPE } from '@formatjs/icu-messageformat-parser';

/**
 * Linearize a structured tree to ICU MessageFormat. Round-trips through
 * `icuToTree` and translates well — any AI model that knows ICU preserves
 * structure correctly.
 */
export function treeToICU(tree: StructuredMessage): string {
  let out = '';
  for (const node of tree) {
    out += nodeToICU(node);
  }
  return out;
}

function nodeToICU(node: TranslationNode): string {
  switch (node.type) {
    case 'text':
      return escapeICU(node.value);
    case 'var':
      return `{${node.name}}`;
    case 'plural': {
      const arms: string[] = [];
      for (const cat of PLURAL_CATEGORIES) {
        const branch = node.forms[cat];
        if (branch) arms.push(`${cat} {${treeToICU(branch)}}`);
      }
      return `{${node.name}, plural, ${arms.join(' ')}}`;
    }
    case 'branch': {
      // BranchNode → ICU `select`. Our `default` is ICU's required `other`.
      const arms: string[] = [];
      const otherTree = node.cases.default ?? [];
      for (const [name, branch] of Object.entries(node.cases)) {
        if (name === 'default') continue;
        arms.push(`${name} {${treeToICU(branch)}}`);
      }
      arms.push(`other {${treeToICU(otherTree)}}`);
      return `{${node.name}, select, ${arms.join(' ')}}`;
    }
    case 'tag':
      return `<${node.tag}>${treeToICU(node.children)}</${node.tag}>`;
  }
}

// Per the ICU spec: `'` doubles, and `{`, `}`, `#` wrap in apostrophes. The
// apostrophe pass runs first so wrapping quotes aren't themselves doubled.
function escapeICU(input: string): string {
  return input.replace(/'/g, "''").replace(/[{}#]/g, (c) => `'${c}'`);
}

/**
 * Parse an ICU string into our structured tree. Inverse of `treeToICU` for
 * the supported subset; everything else collapses to a `var` slot so the
 * runtime can still feed it through `formatICU`.
 */
export function icuToTree(input: string): StructuredMessage {
  return elementsToTree(parseICU(input));
}

function elementsToTree(elements: ReadonlyArray<MessageFormatElement>): StructuredMessage {
  const out: TranslationNode[] = [];
  for (const el of elements) {
    out.push(elementToNode(el));
  }
  return mergeAdjacentText(out);
}

function elementToNode(el: MessageFormatElement): TranslationNode {
  switch (el.type) {
    case TYPE.literal:
      return { type: 'text', value: el.value } satisfies TextNode;

    case TYPE.argument:
      return { type: 'var', name: el.value } satisfies VarNode;

    case TYPE.plural: {
      const forms: Partial<Record<PluralCategory, StructuredMessage>> = {};
      for (const [key, branch] of Object.entries(el.options)) {
        // exact-match arms (`=0`, `=1`, …) aren't representable as a tree
        if (key.startsWith('=')) continue;
        if (!isPluralCategory(key)) continue;
        forms[key] = elementsToTree(branch.value);
      }
      return { type: 'plural', name: el.value, forms } satisfies PluralNode;
    }

    case TYPE.select: {
      const cases: { [caseName: string]: StructuredMessage } = {};
      for (const [key, branch] of Object.entries(el.options)) {
        const caseName = key === 'other' ? 'default' : key;
        cases[caseName] = elementsToTree(branch.value);
      }
      return { type: 'branch', name: el.value, cases } satisfies BranchNode;
    }

    case TYPE.tag:
      return {
        type: 'tag',
        tag: el.value,
        children: elementsToTree(el.children),
      } satisfies TagNode;

    default: {
      const name = (el as { value?: string }).value ?? '';
      return { type: 'var', name } satisfies VarNode;
    }
  }
}
