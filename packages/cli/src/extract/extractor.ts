import { type CatalogEntry, canonicalKey, type Manifest } from '@autotranslate/core';
import { applyContextToKey } from '@autotranslate/core/internal';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type * as t from '@babel/types';
import { jsxChildrenToTree } from './jsx-tree';

// `@babel/traverse` ships an ESM-incompatible default export.
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;

export interface FileExtraction {
  readonly messages: Record<string, CatalogEntry>;
  readonly manifest: Manifest;
}

interface MessageHints {
  readonly context?: string;
  readonly description?: string;
  readonly maxChars?: number;
}

/**
 * Walk a TS / JSX file and extract translatable messages.
 *
 * - `<T>...</T>` blocks → linearized to a `StructuredMessage` and hashed.
 * - `t('literal', { $context?, $maxChars? })` calls bound to `useT()` →
 *   extracted with the literal as the source.
 */
export function extractFile(filePath: string, source: string): FileExtraction {
  const ast = parse(source, {
    sourceType: 'module',
    sourceFilename: filePath,
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  const messages: Record<string, CatalogEntry> = {};
  const manifest: Manifest = {};
  const tBindingNames = new Set<string>();

  const recordOccurrence = (key: string, line: number | null | undefined) => {
    const meta = manifest[key] ?? {};
    const existing = meta.occurrences ? [...meta.occurrences] : [];
    existing.push({ file: filePath, line: line ?? 0 });
    manifest[key] = { ...meta, occurrences: existing };
  };

  traverse(ast, {
    // `const t = useT()` — `useTranslations(ns)` is intentionally excluded
    // (dictionary mode reads from the user-authored dictionary, not literals).
    VariableDeclarator(path) {
      const init = path.node.init;
      if (
        init?.type === 'CallExpression' &&
        init.callee.type === 'Identifier' &&
        init.callee.name === 'useT' &&
        path.node.id.type === 'Identifier'
      ) {
        tBindingNames.add(path.node.id.name);
      }
    },

    JSXElement(path) {
      const opening = path.node.openingElement;
      if (opening.name.type !== 'JSXIdentifier' || opening.name.name !== 'T') return;
      const tree = jsxChildrenToTree(path.node.children);
      if (tree.length === 0) return;
      const meta = readJSXMeta(opening);
      const key = canonicalKey(tree, meta.context);
      messages[key] = tree;
      const existing = manifest[key];
      manifest[key] = mergeMeta(existing, meta);
      recordOccurrence(key, path.node.loc?.start.line);
    },

    CallExpression(path) {
      const callee = path.node.callee;
      if (callee.type !== 'Identifier' || !tBindingNames.has(callee.name)) return;
      const arg = path.node.arguments[0];
      if (!arg || arg.type !== 'StringLiteral') return;
      const literal = arg.value;
      if (literal === '') return;
      const meta = readCallHints(path.node.arguments[1]);
      const key = applyContextToKey(literal, meta.context);
      messages[key] = literal;
      const existing = manifest[key];
      manifest[key] = mergeMeta(existing, meta);
      recordOccurrence(key, path.node.loc?.start.line);
    },
  });

  return { messages, manifest };
}

function readJSXMeta(opening: t.JSXOpeningElement): MessageHints {
  const meta: { context?: string; description?: string; maxChars?: number } = {};
  for (const attr of opening.attributes) {
    if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') continue;
    const name = attr.name.name;
    const value = attr.value;
    if (name === 'context' || name === 'description') {
      const literal = readStringLiteralAttr(value);
      if (literal !== undefined) meta[name] = literal;
    } else if (name === 'maxChars') {
      const num = readNumberAttr(value);
      if (num !== undefined) meta.maxChars = num;
    }
  }
  return meta;
}

function readStringLiteralAttr(value: t.JSXAttribute['value']): string | undefined {
  if (value?.type === 'StringLiteral') return value.value;
  if (value?.type === 'JSXExpressionContainer' && value.expression.type === 'StringLiteral') {
    return value.expression.value;
  }
  return undefined;
}

function readNumberAttr(value: t.JSXAttribute['value']): number | undefined {
  if (value?.type === 'JSXExpressionContainer' && value.expression.type === 'NumericLiteral') {
    return value.expression.value;
  }
  return undefined;
}

function readCallHints(arg: t.CallExpression['arguments'][number] | undefined): MessageHints {
  if (!arg || arg.type !== 'ObjectExpression') return {};
  const meta: { context?: string; description?: string; maxChars?: number } = {};
  for (const prop of arg.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed) continue;
    const key = prop.key;
    let name: string | undefined;
    if (key.type === 'Identifier') name = key.name;
    else if (key.type === 'StringLiteral') name = key.value;
    if (!name) continue;
    if (name === '$context' || name === '$description') {
      const value = prop.value;
      if (value.type === 'StringLiteral') {
        meta[name === '$context' ? 'context' : 'description'] = value.value;
      }
    } else if (name === '$maxChars') {
      const value = prop.value;
      if (value.type === 'NumericLiteral') meta.maxChars = value.value;
    }
  }
  return meta;
}

function mergeMeta(
  existing: Manifest[string] | undefined,
  incoming: MessageHints,
): Manifest[string] {
  return {
    ...existing,
    ...(incoming.context ? { context: incoming.context } : {}),
    ...(incoming.description ? { description: incoming.description } : {}),
    ...(incoming.maxChars !== undefined ? { maxChars: incoming.maxChars } : {}),
  };
}
