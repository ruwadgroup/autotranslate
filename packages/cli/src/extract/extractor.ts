import { type CatalogEntry, canonicalKey, type Manifest } from '@autotranslate/core';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type * as t from '@babel/types';
import { jsxChildrenToTree } from './jsx-tree';

// `@babel/traverse` ships an ESM-incompatible default export; unwrap it.
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;

export interface FileExtraction {
  /** Map of message key → source-locale entry. */
  readonly messages: Record<string, CatalogEntry>;
  /** Source occurrences for each message key. */
  readonly manifest: Manifest;
}

/**
 * Walk a TypeScript / JSX file and extract translatable messages.
 *
 * Two patterns are recognized:
 *
 * 1. **`<T>...</T>` JSX blocks** — the children are linearized to a
 *    `StructuredMessage` and hashed via `canonicalKey`.
 * 2. **`useT()` literal calls** — any `t('literal')` call, where `t` is
 *    bound to a `useT()` invocation in the same file, is extracted with
 *    the literal as both the key and the source.
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
    // First: track names bound to useT(). e.g. `const t = useT();`
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

    // <T>...</T>
    JSXElement(path) {
      const opening = path.node.openingElement;
      if (opening.name.type !== 'JSXIdentifier' || opening.name.name !== 'T') return;
      const tree = jsxChildrenToTree(path.node.children);
      if (tree.length === 0) return;
      const key = canonicalKey(tree);
      messages[key] = tree;
      const meta = readJSXMeta(opening);
      const existing = manifest[key];
      manifest[key] = mergeMeta(existing, meta);
      recordOccurrence(key, path.node.loc?.start.line);
    },

    // t('literal')
    CallExpression(path) {
      const callee = path.node.callee;
      if (callee.type !== 'Identifier' || !tBindingNames.has(callee.name)) return;
      const arg = path.node.arguments[0];
      if (!arg || arg.type !== 'StringLiteral') return;
      const literal = arg.value;
      if (literal === '') return;
      messages[literal] = literal;
      recordOccurrence(literal, path.node.loc?.start.line);
    },
  });

  return { messages, manifest };
}

function readJSXMeta(opening: t.JSXOpeningElement): { context?: string; description?: string } {
  const meta: { context?: string; description?: string } = {};
  for (const attr of opening.attributes) {
    if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') continue;
    const name = attr.name.name;
    if (name !== 'context' && name !== 'description') continue;
    const value = attr.value;
    if (value?.type === 'StringLiteral') {
      meta[name] = value.value;
    } else if (
      value?.type === 'JSXExpressionContainer' &&
      value.expression.type === 'StringLiteral'
    ) {
      meta[name] = value.expression.value;
    }
  }
  return meta;
}

function mergeMeta(
  existing: Manifest[string] | undefined,
  incoming: { context?: string; description?: string },
): Manifest[string] {
  return {
    ...existing,
    ...(incoming.context ? { context: incoming.context } : {}),
    ...(incoming.description ? { description: incoming.description } : {}),
  };
}
