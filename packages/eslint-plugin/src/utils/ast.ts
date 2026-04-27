import type { Rule } from 'eslint';

// `@types/eslint`'s `Rule.Node` only covers the ESTree spec; JSX nodes live
// outside it. We narrow via the discriminator at runtime.
type AnyNode = Rule.Node | { readonly type: string; readonly parent?: AnyNode };

export const TRANSLATION_MARKERS: ReadonlySet<string> = new Set([
  'T',
  'Tx',
  'Var',
  'Plural',
  'Branch',
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
]);

export const TRANSLATOR_FACTORIES: ReadonlySet<string> = new Set([
  'useT',
  'useTranslations',
  'getT',
  'getTranslations',
]);

interface JSXOpeningElementLike {
  readonly type: 'JSXOpeningElement';
  readonly name: { readonly type: string; readonly name?: string };
}

interface JSXElementLike {
  readonly type: 'JSXElement';
  readonly openingElement: JSXOpeningElementLike;
  readonly parent?: AnyNode;
}

/** Returns the nearest enclosing marker name, or `null`. */
export function findMarkerAncestor(
  node: AnyNode,
  markers: ReadonlySet<string> = TRANSLATION_MARKERS,
): string | null {
  let current: AnyNode | undefined = node;
  while (current) {
    if (current.type === 'JSXElement') {
      const opening = (current as JSXElementLike).openingElement;
      if (
        opening.name.type === 'JSXIdentifier' &&
        opening.name.name &&
        markers.has(opening.name.name)
      ) {
        return opening.name.name;
      }
    }
    current = (current.parent ?? undefined) as AnyNode | undefined;
  }
  return null;
}

export function jsxTextHasContent(value: string): boolean {
  return value.replace(/\s+/g, ' ').trim() !== '';
}

interface LiteralLike {
  readonly type: 'Literal';
  readonly value: unknown;
}

interface TemplateLiteralLike {
  readonly type: 'TemplateLiteral';
  readonly expressions: ReadonlyArray<unknown>;
  readonly quasis: ReadonlyArray<{ readonly value: { readonly cooked?: string } }>;
}

/** Returns the literal string when `node` is a static string expression. */
export function readStaticString(
  node: { readonly type: string } | undefined | null,
): string | null {
  if (!node) return null;
  if (node.type === 'Literal') {
    const value = (node as LiteralLike).value;
    return typeof value === 'string' ? value : null;
  }
  if (node.type === 'TemplateLiteral') {
    const tl = node as TemplateLiteralLike;
    if (tl.expressions.length === 0) {
      return tl.quasis[0]?.value.cooked ?? '';
    }
  }
  return null;
}

/** Attributes that may carry untranslated string literals. */
export const ALLOWLIST_ATTRIBUTES: ReadonlySet<string> = new Set([
  // structural
  'className',
  'class',
  'id',
  'key',
  'ref',
  'name',
  'type',
  'role',
  'slot',
  'style',
  'data-testid',
  // navigation / forms
  'href',
  'src',
  'srcSet',
  'alt',
  'as',
  'rel',
  'target',
  'method',
  'action',
  'encType',
  'autoComplete',
  'autoCorrect',
  'spellCheck',
  'pattern',
  'inputMode',
  // layout
  'width',
  'height',
  'size',
  'tabIndex',
  // semantic but locale-neutral
  'lang',
  'dir',
  'translate',
  // testing
  'data-test',
  'data-cy',
]);

interface JSXAttributeLike {
  readonly type: 'JSXAttribute';
  readonly name: { readonly type: string; readonly name?: string | { readonly name: string } };
}

export function jsxAttributeName(
  parent: { readonly type: string } | undefined | null,
): string | null {
  if (parent?.type !== 'JSXAttribute') return null;
  const attr = parent as JSXAttributeLike;
  if (attr.name.type === 'JSXIdentifier' && typeof attr.name.name === 'string') {
    return attr.name.name;
  }
  if (attr.name.type === 'JSXNamespacedName') {
    const inner = attr.name.name;
    if (typeof inner === 'object' && inner && 'name' in inner && typeof inner.name === 'string') {
      return inner.name;
    }
  }
  return null;
}
