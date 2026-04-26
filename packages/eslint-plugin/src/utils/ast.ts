import type { Rule } from 'eslint';

/**
 * `@types/eslint`'s `Rule.Node` only covers the ESTree spec — JSX node
 * types live outside of it. We narrow at runtime via the discriminator and
 * treat the parent chain as loosely typed at the boundary.
 */
type AnyNode = Rule.Node | { readonly type: string; readonly parent?: AnyNode };

/**
 * Marker components that are translation-aware. Anything inside one of these
 * is exempt from the `no-untranslated-jsx` rule.
 */
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

/**
 * Hook factory names that produce a callable translator. `t = useT()` and
 * `t = useTranslations(ns)` both yield a translator-shaped function.
 */
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

/**
 * Walk up the AST to determine whether a node is enclosed by a JSX element
 * named in `markers` (or any descendant of one). Returns the marker name
 * when found, otherwise `null`.
 */
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

/**
 * Trim and decide whether a JSX text node carries any visible content.
 * JSX collapses surrounding whitespace at runtime, so a node containing only
 * whitespace + newlines isn't user-visible copy.
 */
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

/**
 * Check whether `node` is a static string expression — a string `Literal`
 * or a template literal with no expressions. Returns the literal value, or
 * `null` when not translatable.
 */
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

/**
 * Decide whether a JSX attribute is allowed to contain a string literal
 * without translation. Most structural / non-user-facing attributes pass.
 */
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

/**
 * Returns the JSXAttribute name when `parent` is one — otherwise `null`.
 */
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
