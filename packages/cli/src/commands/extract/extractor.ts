import { type CatalogEntry, canonicalKey, type Manifest } from '@autotranslate/core';
import {
  isCopyBearingName,
  NO_TRANSLATE_ATTRIBUTE,
  TRANSLATION_MARKERS,
} from '@autotranslate/core/classifier';
import { sourceKey } from '@autotranslate/core/internal';
import { parse } from '@babel/parser';
import _traverse, { type NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import { jsxChildrenToTree } from './jsx-tree';

// `@babel/traverse` ships an ESM-incompatible default export.
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;

export interface FileExtraction {
  readonly messages: Record<string, CatalogEntry>;
  readonly manifest: Manifest;
}

export interface ExtractFileOptions {
  /** Extract catalog-backed copy props/config fields used by auto mode. */
  readonly includeAutoCopy?: boolean;
}

interface MessageHints {
  readonly context?: string;
  readonly description?: string;
  readonly maxChars?: number;
}

const STANDALONE_T_SOURCES: ReadonlySet<string> = new Set([
  '@autotranslate/core/t',
  '@autotranslate/core/standalone',
]);

const STYLING_CONFIG_SOURCES: ReadonlySet<string> = new Set([
  'tailwind-variants',
  'class-variance-authority',
]);

const JSX_STYLING_PROPS: ReadonlySet<string> = new Set([
  'className',
  'classNames',
  'classes',
  'styles',
]);

/**
 * Walk a TS / JSX file and extract translatable messages.
 *
 * - `<T>...</T>` → linearized to a `StructuredMessage` and hashed.
 * - `t('literal', …)` bound to `useT()` or imported from
 *   `@autotranslate/core/t` → extracted with the literal as the source.
 */
export function extractFile(
  filePath: string,
  source: string,
  options: ExtractFileOptions = {},
): FileExtraction {
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

  const recordAutoCopy = (value: string | null, line: number | null | undefined) => {
    if (!value) return;
    const tree = [{ type: 'text' as const, value }];
    const key = canonicalKey(tree);
    messages[key] = tree;
    recordOccurrence(key, line);
  };

  traverse(ast, {
    ImportDeclaration(path) {
      if (!STANDALONE_T_SOURCES.has(path.node.source.value)) return;
      for (const spec of path.node.specifiers) {
        if (spec.type !== 'ImportSpecifier') continue;
        const imported = spec.imported;
        const importedName = imported.type === 'Identifier' ? imported.name : imported.value;
        if (importedName === 't') tBindingNames.add(spec.local.name);
      }
    },

    // `const t = useT()` — track the local alias for call-site extraction.
    VariableDeclarator(path) {
      if (
        options.includeAutoCopy &&
        path.node.id.type === 'Identifier' &&
        isCopyBearingName(path.node.id.name)
      ) {
        recordAutoCopy(readAutoCopyString(path.node.init), path.node.loc?.start.line);
      }
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

    JSXAttribute(path) {
      if (!options.includeAutoCopy) return;
      const attr = path.node;
      if (attr.name.type !== 'JSXIdentifier' || !isCopyBearingName(attr.name.name)) return;
      const opening = path.parent;
      if (opening.type !== 'JSXOpeningElement' || !isCustomJSXName(opening.name)) return;
      if (
        (opening.name.type === 'JSXIdentifier' && TRANSLATION_MARKERS.has(opening.name.name)) ||
        opening.attributes.some(
          (candidate) =>
            candidate.type === 'JSXAttribute' &&
            candidate.name.type === 'JSXIdentifier' &&
            candidate.name.name === NO_TRANSLATE_ATTRIBUTE,
        )
      ) {
        return;
      }
      recordAutoCopy(readAutoCopyString(attr.value), attr.loc?.start.line);
    },

    ObjectProperty(path) {
      if (!options.includeAutoCopy || path.node.computed) return;
      const name = objectPropertyName(path.node.key);
      if (!name || !isCopyBearingName(name)) return;
      if (isInsideStylingConfigCall(path) || isInsideJSXStylingProp(path)) return;
      recordAutoCopy(readAutoCopyString(path.node.value), path.node.loc?.start.line);
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
      const literal = resolveStaticString(arg, path);
      if (!literal) return;
      const meta = readCallHints(path.node.arguments[1]);
      const key = sourceKey(literal, meta.context);
      messages[key] = literal;
      const existing = manifest[key];
      manifest[key] = mergeMeta(existing, meta);
      recordOccurrence(key, path.node.loc?.start.line);
    },
  });

  return { messages, manifest };
}

function isInsideStylingConfigCall(path: NodePath<t.ObjectProperty>): boolean {
  return Boolean(
    path.findParent((parent) => {
      if (!parent.isCallExpression() || parent.node.callee.type !== 'Identifier') return false;
      const binding = parent.scope.getBinding(parent.node.callee.name);
      const declaration = binding?.path.parentPath;
      return (
        binding?.path.isImportSpecifier() === true &&
        declaration?.isImportDeclaration() === true &&
        STYLING_CONFIG_SOURCES.has(declaration.node.source.value)
      );
    }),
  );
}

function isInsideJSXStylingProp(path: NodePath<t.ObjectProperty>): boolean {
  return Boolean(
    path.findParent(
      (parent) =>
        parent.isJSXAttribute() &&
        parent.node.name.type === 'JSXIdentifier' &&
        JSX_STYLING_PROPS.has(parent.node.name.name),
    ),
  );
}

function isCustomJSXName(name: t.JSXOpeningElement['name']): boolean {
  return (
    name.type === 'JSXMemberExpression' ||
    (name.type === 'JSXIdentifier' && /^[A-Z]/.test(name.name))
  );
}

function objectPropertyName(key: t.ObjectProperty['key']): string | null {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  return null;
}

function readAutoCopyString(node: t.Node | null | undefined): string | null {
  if (!node) return null;
  if (node.type === 'StringLiteral') return node.value || null;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked || null;
  }
  if (node.type === 'JSXExpressionContainer') return readAutoCopyString(node.expression);
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'TSNonNullExpression'
  ) {
    return readAutoCopyString(node.expression);
  }
  return null;
}

// The no-dynamic-key lint rule accepts `const KEY = '...'; t(KEY)` as static,
// so the extractor must resolve the same shapes or blessed code silently
// misses the catalog. Kept in lockstep with the rule: direct string literals,
// expressionless template literals, and same-file const string bindings.
function resolveStaticString(
  arg: t.Node | null | undefined,
  path: {
    scope: {
      getBinding(name: string): { constant: boolean; path: { node: t.Node } } | undefined;
    };
  },
): string | null {
  if (!arg) return null;
  if (arg.type === 'StringLiteral') return arg.value || null;
  if (arg.type === 'TemplateLiteral' && arg.expressions.length === 0) {
    return arg.quasis[0]?.value.cooked || null;
  }
  if (arg.type === 'Identifier') {
    const binding = path.scope.getBinding(arg.name);
    const node = binding?.path.node;
    if (binding?.constant && node?.type === 'VariableDeclarator' && node.init) {
      return resolveStaticString(node.init, path);
    }
  }
  return null;
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
  if (arg?.type !== 'ObjectExpression') return {};
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
