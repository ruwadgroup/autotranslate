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
  const out: TranslationNode[] = [];
  for (const child of children) {
    const node = nodeToTreeNode(child);
    if (node) out.push(...(Array.isArray(node) ? node : [node]));
  }
  return mergeText(out);
}

function nodeToTreeNode(node: t.Node): TranslationNode | TranslationNode[] | null {
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
      return jsxChildrenToTree(node.children) as TranslationNode[];
    case 'JSXElement':
      return elementToTreeNode(node);
    default:
      return null;
  }
}

function elementToTreeNode(el: t.JSXElement): TranslationNode | null {
  const opening = el.openingElement;
  const tag = jsxNameToString(opening.name);
  if (tag === 'Var') return varNode(opening);
  if (tag === 'Plural') return pluralNode(opening, el);
  // HTML element / unknown component → tag node. We strip props from the
  // canonical form because translators shouldn't translate `href`/`onClick`
  // and we don't want them affecting the hash.
  return {
    type: 'tag',
    tag,
    children: jsxChildrenToTree(el.children),
  };
}

function varNode(opening: t.JSXOpeningElement): TranslationNode {
  const name = readStringAttribute(opening, 'name') ?? 'value';
  return { type: 'var', name };
}

const PLURAL_FORMS: ReadonlyArray<PluralCategory> = ['zero', 'one', 'two', 'few', 'many', 'other'];

function pluralNode(opening: t.JSXOpeningElement, _el: t.JSXElement): TranslationNode {
  const name = readStringAttribute(opening, 'name') ?? 'count';
  const forms: { -readonly [K in PluralCategory]?: StructuredMessage } = {};
  for (const cat of PLURAL_FORMS) {
    const value = readJSXAttribute(opening, cat);
    if (value === undefined) continue;
    forms[cat] = readBranch(value);
  }
  return { type: 'plural', name, forms };
}

function readBranch(value: t.JSXAttribute['value']): StructuredMessage {
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
      return jsxChildrenToTree(children);
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
