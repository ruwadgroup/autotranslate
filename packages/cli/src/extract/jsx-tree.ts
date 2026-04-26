import type { StructuredMessage, TranslationNode } from '@autotranslate/core';
import type { PluralCategory } from '@autotranslate/core/locale';
import type * as t from '@babel/types';

/**
 * Convert the children of a `<T>` JSX element into a canonical
 * `StructuredMessage`. Mirrors the runtime walker in
 * `@autotranslate/react/serialize-children` — both must agree on the shape
 * for the canonical hash to match between extraction and runtime.
 */
export function jsxChildrenToTree(children: ReadonlyArray<t.Node>): StructuredMessage {
  const state: ExtractState = { formatCount: new Map() };
  return childrenToTree(children, state);
}

interface ExtractState {
  /** Per-formatter occurrence counter. Mirrors the runtime serializer. */
  readonly formatCount: Map<string, number>;
}

function childrenToTree(children: ReadonlyArray<t.Node>, state: ExtractState): StructuredMessage {
  const out: TranslationNode[] = [];
  for (const child of children) {
    const node = nodeToTreeNode(child, state);
    if (node) out.push(...(Array.isArray(node) ? node : [node]));
  }
  return mergeText(out);
}

function nodeToTreeNode(
  node: t.Node,
  state: ExtractState,
): TranslationNode | TranslationNode[] | null {
  switch (node.type) {
    case 'JSXText': {
      // JSX collapses surrounding whitespace; the runtime sees the same
      // text via `Children.forEach` → match that normalization here.
      const value = node.value.replace(/\s+/g, ' ');
      if (value === '' || value === ' ') return null;
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
      // Anything else inside `{ ... }` between JSX siblings is a runtime
      // expression — at extract time we can't know its value. Skip; the
      // ESLint plugin (later) will warn against expressions outside
      // `<Var>` / `<Plural>`.
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

const FORMAT_MARKERS: Readonly<Record<string, string>> = {
  Num: 'num',
  Currency: 'currency',
  DateTime: 'dt',
  RelativeTime: 'rel',
};

function elementToTreeNode(el: t.JSXElement, state: ExtractState): TranslationNode | null {
  const opening = el.openingElement;
  const tag = jsxNameToString(opening.name);
  if (tag === 'Var') return varNode(opening);
  if (tag === 'Plural') return pluralNode(opening, el, state);
  if (tag === 'Branch') return branchNode(opening, el, state);
  const formatPrefix = FORMAT_MARKERS[tag];
  if (formatPrefix) return formatNode(opening, formatPrefix, state);
  // HTML element / unknown component → tag node. We strip props from the
  // canonical form because translators shouldn't translate `href`/`onClick`
  // and we don't want them affecting the hash.
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
  const name = explicit ?? `${prefix}#${occurrence}`;
  return { type: 'var', name };
}

function varNode(opening: t.JSXOpeningElement): TranslationNode {
  const name = readStringAttribute(opening, 'name') ?? 'value';
  return { type: 'var', name };
}

const PLURAL_FORMS: ReadonlyArray<PluralCategory> = ['zero', 'one', 'two', 'few', 'many', 'other'];

function pluralNode(
  opening: t.JSXOpeningElement,
  _el: t.JSXElement,
  state: ExtractState,
): TranslationNode {
  const name = readStringAttribute(opening, 'name') ?? 'count';
  const forms: { -readonly [K in PluralCategory]?: StructuredMessage } = {};
  for (const cat of PLURAL_FORMS) {
    const value = readJSXAttribute(opening, cat);
    if (value === undefined) continue;
    forms[cat] = readBranch(value, state);
  }
  return { type: 'plural', name, forms };
}

const BRANCH_RESERVED: ReadonlySet<string> = new Set(['branch', 'name', 'key', 'ref']);

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
    if (BRANCH_RESERVED.has(propName)) continue;
    cases[propName] = readBranch(attr.value, state);
  }
  // Children → default fallback case.
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

function mergeText(nodes: TranslationNode[]): StructuredMessage {
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
