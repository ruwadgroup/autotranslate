import { shortHash } from './hash';
import { getPluralCategory, type PluralCategory } from './plural';
import type { Locale } from './types';

export interface TextNode {
  readonly type: 'text';
  readonly value: string;
}

export interface VarNode {
  readonly type: 'var';
  readonly name: string;
}

export interface PluralNode {
  readonly type: 'plural';
  readonly name: string;
  readonly forms: { readonly [K in PluralCategory]?: StructuredMessage };
}

export interface BranchNode {
  readonly type: 'branch';
  readonly name: string;
  readonly cases: { readonly [caseName: string]: StructuredMessage };
}

export interface TagNode {
  readonly type: 'tag';
  readonly tag: string;
  readonly children: StructuredMessage;
}

export type TranslationNode = TextNode | VarNode | PluralNode | BranchNode | TagNode;

export type StructuredMessage = ReadonlyArray<TranslationNode>;

export function isStructured(value: unknown): value is StructuredMessage {
  return Array.isArray(value);
}

export const MARKER_NAMES: ReadonlySet<string> = new Set([
  'Var',
  'Plural',
  'Branch',
  'Num',
  'Currency',
  'DateTime',
  'RelativeTime',
]);

export const FORMAT_MARKER_PREFIX: Readonly<Record<string, string>> = {
  Num: 'num',
  Currency: 'currency',
  DateTime: 'dt',
  RelativeTime: 'rel',
};

export const BRANCH_RESERVED_PROPS: ReadonlySet<string> = new Set([
  'branch',
  'name',
  'children',
  'key',
  'ref',
]);

export function mergeAdjacentText(nodes: ReadonlyArray<TranslationNode>): TranslationNode[] {
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

/**
 * Canonical JSON form of a tree: object keys sorted, no whitespace.
 * Wire format — extractor and runtime must agree.
 */
export function canonicalize(tree: StructuredMessage): string {
  return JSON.stringify(tree, sortKeys);
}

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

export const TREE_KEY_PREFIX = 't.';

/** Stable hash key for a tree. `context` mixes in to disambiguate identical copy. */
export function canonicalKey(tree: StructuredMessage, context?: string): string {
  const canonical = context ? `${canonicalize(tree)}ctx:${context}` : canonicalize(tree);
  return `${TREE_KEY_PREFIX}${shortHash(canonical)}`;
}

/** Render a tree to plain text. Tag wrappers are dropped; only children render. */
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
      return v == null ? `{${node.name}}` : String(v);
    }
    case 'plural': {
      const raw = params[node.name];
      const num = typeof raw === 'number' ? raw : Number(raw);
      const branch = Number.isFinite(num)
        ? (node.forms[getPluralCategory(locale, num)] ?? node.forms.other)
        : node.forms.other;
      if (!branch) return '';
      const replacement = Number.isFinite(num) ? String(num) : '';
      return renderTreeToString(branch, locale, params).replace(/#/g, replacement);
    }
    case 'branch': {
      const raw = params[node.name];
      const key = raw == null ? 'default' : String(raw);
      const branch = node.cases[key] ?? node.cases.default;
      if (!branch) return '';
      return renderTreeToString(branch, locale, params);
    }
    case 'tag':
      return renderTreeToString(node.children, locale, params);
  }
}
