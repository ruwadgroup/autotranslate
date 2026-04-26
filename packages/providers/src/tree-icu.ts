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
import type { PluralCategory } from '@autotranslate/core/locale';
import { type MessageFormatElement, TYPE } from '@formatjs/icu-messageformat-parser';

/**
 * Linearize a structured tree to ICU MessageFormat.
 *
 * The output is a single ICU string that round-trips through `icuToTree` and
 * is a far better fit for AI translation than custom JSON: any model that
 * knows ICU (which is most of them) can preserve structure correctly.
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
      const order: PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other'];
      for (const cat of order) {
        const branch = node.forms[cat];
        if (branch) arms.push(`${cat} {${treeToICU(branch)}}`);
      }
      return `{${node.name}, plural, ${arms.join(' ')}}`;
    }
    case 'branch': {
      // Map BranchNode → ICU `select`. Our `default` case is ICU's `other`
      // (which `select` requires). Identifier-only case names are emitted
      // unquoted; anything else is bracket-keyed.
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

/**
 * Escape ICU special characters in literal text.
 *
 * Per the ICU spec: `'` is escaped by doubling (`''`), and `{`, `}`, `#`
 * are escaped by wrapping in apostrophes (`'{'`, `'}'`, `'#'`). The
 * apostrophe pass runs first so the wrapping quotes aren't themselves
 * doubled.
 */
function escapeICU(input: string): string {
  return input.replace(/'/g, "''").replace(/[{}#]/g, (c) => `'${c}'`);
}

/**
 * Parse an ICU string back into our structured tree.
 *
 * Inverse of `treeToICU` for the subset of ICU we emit (text, argument,
 * plural, tag). Anything outside that subset (`select`, `number`, `date`,
 * `time`, `selectordinal`) is preserved as a single `var` node so the
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
        if (key.startsWith('=')) continue; // exact-match arms aren't representable in tree form
        if (!isPluralCategory(key)) continue;
        forms[key] = elementsToTree(branch.value);
      }
      return { type: 'plural', name: el.value, forms } satisfies PluralNode;
    }

    case TYPE.select: {
      const cases: { [caseName: string]: StructuredMessage } = {};
      for (const [key, branch] of Object.entries(el.options)) {
        // ICU `select` requires `other` — map it to our `default`.
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

    // Anything not in our tree shape (select, number, date, time, pound,
    // selectordinal) is captured as a var slot — the runtime forwards the
    // original ICU text through `formatICU`.
    default: {
      const name = (el as { value?: string }).value ?? '';
      return { type: 'var', name } satisfies VarNode;
    }
  }
}

const PLURAL_CATEGORIES: ReadonlySet<string> = new Set([
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
]);

function isPluralCategory(value: string): value is PluralCategory {
  return PLURAL_CATEGORIES.has(value);
}

function mergeAdjacentText(nodes: TranslationNode[]): TranslationNode[] {
  const merged: TranslationNode[] = [];
  for (const node of nodes) {
    const last = merged[merged.length - 1];
    if (node.type === 'text' && last?.type === 'text') {
      merged[merged.length - 1] = { type: 'text', value: last.value + node.value };
    } else {
      merged.push(node);
    }
  }
  return merged;
}
