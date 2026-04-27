import type { StructuredMessage, TranslationNode } from '@autotranslate/core';
import {
  BRANCH_RESERVED_PROPS,
  FORMAT_MARKER_PREFIX,
  mergeAdjacentText,
} from '@autotranslate/core/internal';
import { PLURAL_CATEGORIES, type PluralCategory } from '@autotranslate/core/locale';
import type * as t from '@babel/types';

/**
 * Convert the children of a `<T>` JSX element into a canonical message.
 * Mirrors the runtime walker in `@autotranslate/react/serialize-children`.
 */
export function jsxChildrenToTree(children: ReadonlyArray<t.Node>): StructuredMessage {
  const state: ExtractState = { formatCount: new Map() };
  return childrenToTree(children, state);
}

interface ExtractState {
  readonly formatCount: Map<string, number>;
}

function childrenToTree(children: ReadonlyArray<t.Node>, state: ExtractState): StructuredMessage {
  const out: TranslationNode[] = [];
  for (const child of children) {
    const node = nodeToTreeNode(child, state);
    if (node) out.push(...(Array.isArray(node) ? node : [node]));
  }
  return mergeAdjacentText(out);
}

function nodeToTreeNode(
  node: t.Node,
  state: ExtractState,
): TranslationNode | TranslationNode[] | null {
  switch (node.type) {
    case 'JSXText': {
      const value = normalizeJSXText(node.value);
      if (value === '') return null;
      return { type: 'text', value };
    }
    case 'JSXExpressionContainer': {
      const expr = node.expression;
      if (expr.type === 'StringLiteral') {
        return { type: 'text', value: expr.value };
      }
      if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
        return { type: 'text', value: expr.quasis[0]?.value.cooked ?? '' };
      }
      if (expr.type === 'NumericLiteral') {
        return { type: 'text', value: String(expr.value) };
      }
      return null;
    }
    case 'JSXFragment':
      return childrenToTree(node.children, state) as TranslationNode[];
    case 'JSXElement':
      return elementToTreeNode(node, state);
    default:
      return null;
  }
}

function elementToTreeNode(el: t.JSXElement, state: ExtractState): TranslationNode | null {
  const opening = el.openingElement;
  const tag = jsxNameToString(opening.name);
  if (tag === 'Var') return varNode(opening);
  if (tag === 'Plural') return pluralNode(opening, state);
  if (tag === 'Branch') return branchNode(opening, el, state);
  const formatPrefix = FORMAT_MARKER_PREFIX[tag];
  if (formatPrefix) return formatNode(opening, formatPrefix, state);
  return {
    type: 'tag',
    tag,
    children: childrenToTree(el.children, state),
  };
}

function formatNode(
  opening: t.JSXOpeningElement,
  prefix: string,
  state: ExtractState,
): TranslationNode {
  const explicit = readStringAttribute(opening, 'name');
  const occurrence = state.formatCount.get(prefix) ?? 0;
  state.formatCount.set(prefix, occurrence + 1);
  const name = explicit ?? `${prefix}_${occurrence}`;
  return { type: 'var', name };
}

function varNode(opening: t.JSXOpeningElement): TranslationNode {
  const name = readStringAttribute(opening, 'name') ?? 'value';
  return { type: 'var', name };
}

function pluralNode(opening: t.JSXOpeningElement, state: ExtractState): TranslationNode {
  const name = readStringAttribute(opening, 'name') ?? 'count';
  const forms: { -readonly [K in PluralCategory]?: StructuredMessage } = {};
  for (const cat of PLURAL_CATEGORIES) {
    const value = readJSXAttribute(opening, cat);
    if (value === undefined) continue;
    forms[cat] = readBranch(value, state);
  }
  return { type: 'plural', name, forms };
}

function branchNode(
  opening: t.JSXOpeningElement,
  el: t.JSXElement,
  state: ExtractState,
): TranslationNode {
  const name = readStringAttribute(opening, 'name') ?? 'branch';
  const cases: { [caseName: string]: StructuredMessage } = {};
  for (const attr of opening.attributes) {
    if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') continue;
    const propName = attr.name.name;
    if (BRANCH_RESERVED_PROPS.has(propName)) continue;
    cases[propName] = readBranch(attr.value, state);
  }
  const childTree = childrenToTree(el.children, state);
  if (childTree.length > 0) {
    cases.default = childTree;
  }
  return { type: 'branch', name, cases };
}

function readBranch(value: t.JSXAttribute['value'], state: ExtractState): StructuredMessage {
  if (!value) return [];
  if (value.type === 'StringLiteral') {
    return [{ type: 'text', value: value.value }];
  }
  if (value.type === 'JSXExpressionContainer') {
    const expr = value.expression;
    if (expr.type === 'StringLiteral') {
      return [{ type: 'text', value: expr.value }];
    }
    if (expr.type === 'JSXElement' || expr.type === 'JSXFragment') {
      const children = expr.type === 'JSXFragment' ? expr.children : [expr];
      return childrenToTree(children, state);
    }
  }
  return [];
}

function readStringAttribute(opening: t.JSXOpeningElement, name: string): string | undefined {
  const value = readJSXAttribute(opening, name);
  if (!value) return undefined;
  if (value.type === 'StringLiteral') return value.value;
  if (value.type === 'JSXExpressionContainer' && value.expression.type === 'StringLiteral') {
    return value.expression.value;
  }
  return undefined;
}

function readJSXAttribute(
  opening: t.JSXOpeningElement,
  name: string,
): t.JSXAttribute['value'] | undefined {
  for (const attr of opening.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === name
    ) {
      return attr.value;
    }
  }
  return undefined;
}

function jsxNameToString(node: t.JSXOpeningElement['name']): string {
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${jsxNameToString(node.object)}.${node.property.name}`;
  }
  if (node.type === 'JSXNamespacedName') {
    return `${node.namespace.name}:${node.name.name}`;
  }
  return 'Unknown';
}

// Mirrors React's JSX-runtime whitespace handling (`@babel/types`'s
// `cleanJSXElementLiteralChild`): drop whitespace-only lines, collapse tabs
// to spaces, trim leading whitespace on continuation lines and trailing on
// non-final lines, then join with single spaces.
function normalizeJSXText(value: string): string {
  const lines = value.split(/\r\n|\r|\n/);
  let lastNonEmpty = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() !== '') lastNonEmpty = i;
  }
  if (lastNonEmpty === -1) return '';
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!.replace(/\t/g, ' ');
    const isFirst = i === 0;
    const isLastNonEmpty = i === lastNonEmpty;
    if (!isFirst) line = line.replace(/^ +/, '');
    if (!isLastNonEmpty) line = line.replace(/ +$/, '');
    if (line === '') continue;
    if (!isLastNonEmpty) line += ' ';
    out += line;
  }
  return out;
}
