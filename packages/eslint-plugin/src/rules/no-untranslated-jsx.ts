import type { Rule } from 'eslint';
import {
  findMarkerAncestor,
  isAllowlistedAttribute,
  isCopyBearingName,
  jsxAttributeName,
  jsxTextHasContent,
  readStaticString,
} from '../utils/ast';

interface RuleOptions {
  readonly allowAttributes?: ReadonlyArray<string>;
  readonly markers?: ReadonlyArray<string>;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require user-visible JSX string literals to be wrapped in a <T> component.',
      url: 'https://github.com/ruwadgroup/autotranslate/tree/main/packages/eslint-plugin#no-untranslated-jsx',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowAttributes: { type: 'array', items: { type: 'string' } },
          markers: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      bareText:
        'String literal {{ snippet }} is not wrapped in <T>. Wrap it in <T> or hoist via useT().',
      bareAttribute:
        'String literal in JSX attribute "{{ name }}" is not translated. Use useT() for the value.',
      dynamicCopy:
        'Copy-bearing expression "{{ name }}" is not translated. Auto mode handles catalog-backed values; otherwise use <T> or useT().',
    },
  },
  create(context) {
    const options = (context.options[0] ?? {}) as RuleOptions;
    const extraAttrs = new Set(options.allowAttributes ?? []);
    const extraMarkers = new Set(options.markers ?? []);
    const markerNames = new Set([
      ...['T', 'Var', 'Plural', 'Branch', 'Num', 'Currency', 'DateTime', 'RelativeTime'],
      ...extraMarkers,
    ]);

    return {
      // ESLint's bundled types don't model JSX nodes; cast through `unknown`.
      JSXText(rawNode: unknown) {
        const node = rawNode as { value: string; parent?: unknown };
        if (!jsxTextHasContent(node.value)) return;
        if (findMarkerAncestor(node as never, markerNames)) return;
        const trimmed = node.value.trim();
        const snippet = trimmed.length > 24 ? `"${trimmed.slice(0, 21)}…"` : `"${trimmed}"`;
        context.report({ node: node as Rule.Node, messageId: 'bareText', data: { snippet } });
      },
      'JSXExpressionContainer Literal'(rawNode: unknown) {
        const node = rawNode as {
          type: string;
          value?: unknown;
          parent?: { type: string; parent?: { type: string } };
        };
        const literalValue = readStaticString(node);
        if (literalValue === null || literalValue.trim() === '') return;
        const container = node.parent;
        if (container?.type !== 'JSXExpressionContainer') return;
        if (container.parent?.type === 'JSXAttribute') return;
        if (findMarkerAncestor(node as never, markerNames)) return;
        const snippet =
          literalValue.length > 24 ? `"${literalValue.slice(0, 21)}…"` : `"${literalValue}"`;
        context.report({ node: node as Rule.Node, messageId: 'bareText', data: { snippet } });
      },
      JSXExpressionContainer(rawNode: unknown) {
        const node = rawNode as {
          type: string;
          expression?: DynamicExpressionLike;
          parent?: { type: string };
        };
        if (node.parent?.type === 'JSXAttribute') return;
        const name = copyBearingExpressionName(node.expression);
        if (!name || findMarkerAncestor(node as never, markerNames)) return;
        context.report({
          node: node as Rule.Node,
          messageId: 'dynamicCopy',
          data: { name },
        });
      },
      JSXAttribute(rawNode: unknown) {
        const node = rawNode as {
          type: string;
          name: unknown;
          value?: { type: string; value?: unknown; expression?: { type: string } };
          parent?: { type: string; name?: { type: string; name?: string } };
        };
        const name = jsxAttributeName(node);
        if (!name) return;
        if (isAllowlistedAttribute(name) || extraAttrs.has(name)) return;
        const opening = node.parent;
        if (
          opening?.type === 'JSXOpeningElement' &&
          opening.name?.type === 'JSXIdentifier' &&
          opening.name.name &&
          markerNames.has(opening.name.name)
        ) {
          return;
        }
        const value = node.value;
        if (!value) return;
        let literal: string | null = null;
        if (value.type === 'Literal' && typeof value.value === 'string') {
          literal = value.value;
        } else if (value.type === 'JSXExpressionContainer') {
          literal = readStaticString(value.expression);
        }
        if (literal === null || literal.trim() === '') return;
        context.report({ node: node as Rule.Node, messageId: 'bareAttribute', data: { name } });
      },
    };
  },
};

interface DynamicExpressionLike {
  readonly type: string;
  readonly name?: string;
  readonly computed?: boolean;
  readonly property?: DynamicExpressionLike;
  readonly expression?: DynamicExpressionLike;
}

function copyBearingExpressionName(node: DynamicExpressionLike | undefined): string | null {
  if (!node) return null;
  if (node.type === 'Identifier' && node.name && isCopyBearingName(node.name)) return node.name;
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property?.type === 'Identifier' &&
    node.property.name &&
    isCopyBearingName(node.property.name)
  ) {
    return node.property.name;
  }
  if (node.type === 'ChainExpression' || node.type === 'TSAsExpression') {
    return copyBearingExpressionName(node.expression);
  }
  return null;
}

export default rule;
