import { shortHash } from './hash';
import { getPluralCategory, type PluralCategory } from './plural';
import type { Locale } from './types';

/** Plain text segment between markup. Adjacent text nodes are pre-merged. */
export interface TextNode {
  readonly type: 'text';
  readonly value: string;
}

/**
 * Variable interpolation slot. `name` is the prop key passed to the runtime
 * via `params` / the `<Var name>` prop.
 */
export interface VarNode {
  readonly type: 'var';
  readonly name: string;
}

/**
 * Plural branch. `forms` carries the trees for each CLDR category that the
 * author provided. The `other` form is required at extraction time.
 */
export interface PluralNode {
  readonly type: 'plural';
  readonly name: string;
  readonly forms: { readonly [K in PluralCategory]?: StructuredMessage };
}

/**
 * Status / discriminator branch. Like `PluralNode`, but the selector is a
 * free-form string value (e.g. `'pending' | 'shipped' | 'delivered'`) and
 * the case names are user-defined. The `default` case is the fallback.
 */
export interface BranchNode {
  readonly type: 'branch';
  readonly name: string;
  readonly cases: { readonly [caseName: string]: StructuredMessage };
}

/**
 * HTML element or simple component wrapper inside a `<T>` tree (e.g. `<a>`,
 * `<strong>`). Component trees are flattened into tag nodes so translators
 * see structure without prop noise.
 */
export interface TagNode {
  readonly type: 'tag';
  readonly tag: string;
  readonly children: StructuredMessage;
}

export type TranslationNode = TextNode | VarNode | PluralNode | BranchNode | TagNode;

export type StructuredMessage = ReadonlyArray<TranslationNode>;

/**
 * Type guard for catalog entries.
 */
export function isStructured(value: unknown): value is StructuredMessage {
  return Array.isArray(value);
}

/**
 * Canonical JSON form of a tree: object keys sorted, no whitespace.
 *
 * The output is an input to `shortHash` to derive a stable key, so changing
 * its shape is a wire-format break — both extractor and runtime must agree.
 */
export function canonicalize(tree: StructuredMessage): string {
  return JSON.stringify(tree, sortKeys);
}

// Returning a new object from a JSON.stringify replacer reorders its keys
// because Object.keys iterates insertion order — JSON.stringify then walks
// the replacer's output in that (sorted) order.
function sortKeys(_key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const input = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(input).sort()) {
    sorted[k] = input[k];
  }
  return sorted;
}

/** Canonical key prefix for `<T>` trees. Distinguishes them from `useT` keys. */
export const TREE_KEY_PREFIX = 't.';

/**
 * Stable canonical key for a structured message. Identical trees produce
 * identical keys regardless of authoring whitespace or prop order.
 *
 * `context`, when supplied, mixes into the hash so two identical trees with
 * different translator-facing contexts get distinct keys.
 */
export function canonicalKey(tree: StructuredMessage, context?: string): string {
  const canonical = context ? `${canonicalize(tree)}ctx:${context}` : canonicalize(tree);
  return `${TREE_KEY_PREFIX}${shortHash(canonical)}`;
}

/**
 * Render a tree to plain text using `params` for `<Var>` and `<Plural>` slots.
 * Tag wrappers are dropped — only their children are rendered. Suitable for
 * `useT` callers that need a string out of a structured catalog entry.
 */
export function renderTreeToString(
  tree: StructuredMessage,
  locale: Locale,
  params: Readonly<Record<string, unknown>> = {},
): string {
  let out = '';
  for (const node of tree) {
    out += renderNode(node, locale, params);
  }
  return out;
}

function renderNode(
  node: TranslationNode,
  locale: Locale,
  params: Readonly<Record<string, unknown>>,
): string {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'var': {
      const v = params[node.name];
      return v === undefined || v === null ? `{${node.name}}` : String(v);
    }
    case 'plural': {
      const raw = params[node.name];
      const num = typeof raw === 'number' ? raw : Number(raw);
      // Non-finite count → render the `other` form with `#` blanked. This
      // matches `formatICU` behavior and keeps copy reasonable when callers
      // forget to pass a count.
      const branch = Number.isFinite(num)
        ? (node.forms[getPluralCategory(locale, num)] ?? node.forms.other)
        : node.forms.other;
      if (!branch) return '';
      const replacement = Number.isFinite(num) ? String(num) : '';
      return renderTreeToString(branch, locale, params).replace(/#/g, replacement);
    }
    case 'branch': {
      const raw = params[node.name];
      const key = raw === undefined || raw === null ? 'default' : String(raw);
      const branch = node.cases[key] ?? node.cases.default;
      if (!branch) return '';
      return renderTreeToString(branch, locale, params);
    }
    case 'tag':
      return renderTreeToString(node.children, locale, params);
  }
}
