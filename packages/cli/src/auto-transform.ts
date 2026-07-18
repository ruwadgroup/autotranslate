import {
  isCopyBearingName,
  isTranslatableAttribute,
  jsxTextHasContent,
  NO_TRANSLATE_ATTRIBUTE,
  SKIP_ELEMENTS,
  TRANSLATION_MARKERS,
} from '@autotranslate/core/classifier';
import { parse } from '@babel/parser';
import _traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// `@babel/traverse` ships an ESM-incompatible default export.
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;

const REACT_MODULE = '@autotranslate/react';

export interface TransformAutoWrapOptions {
  readonly filename: string;
}

export interface TransformAutoWrapResult {
  readonly code: string;
  readonly changed: boolean;
}

/**
 * Cheap pre-filter: only files that plausibly contain letter-bearing JSX text
 * (a `>` or `}` followed by letters before the next `<`/`{`) are worth parsing.
 */
const LETTER_BEARING_JSX = /[>}][^<>{}]*[A-Za-z]/;

/** Cheap companion pre-filter for dynamic copy such as `{title}` / `{item.label}`. */
const COPY_BEARING_JSX_EXPRESSION = /{\s*[$A-Z_a-z][\w$]*(?:\??\.[$A-Z_a-z][\w$]*)*\s*}/;

/**
 * Cheap companion pre-filter for copy-bearing JSX attributes such as
 * `placeholder="Search cases"` (a component whose only copy lives in attributes
 * matches neither pattern above). JSX-style `name="…"` (no spaces around `=`)
 * keeps this from firing on most plain JS assignments; false positives only cost
 * a parse that finds nothing.
 */
const COPY_BEARING_JSX_ATTRIBUTE = /\s[A-Za-z][\w-]*=["'][^"'<>]*[A-Za-z]/;

// Insertion ordering at a shared offset: closes precede opens, and the T
// wrapper stays outside any Var wrapper it contains.
const ORDER_VAR_CLOSE = 0;
const ORDER_T_CLOSE = 1;
const ORDER_T_OPEN = 2;
const ORDER_VAR_OPEN = 3;

// Attribute auto-translation insertions sit at distinct offsets (inside an
// attribute value, or at a function body's opening brace) so these orders only
// disambiguate the rare exact-offset tie.
const ORDER_ATTR_OPEN = 2;
const ORDER_ATTR_CLOSE = 1;
const ORDER_INJECT = 5;

interface Insertion {
  readonly pos: number;
  readonly order: number;
  readonly text: string;
}

type MemberKind =
  // JSXText with no visible content, or an empty `{}` / comment container.
  | 'whitespace'
  // JSXText that carries translatable copy.
  | 'contentText'
  // `{'x'}` / `` {`x`} `` — static text with visible content.
  | 'staticContent'
  // `{5}` / `{''}` — static but not copy; travels inside a T, never qualifies one.
  | 'staticEmpty'
  // `{expr}` — dynamic value, wrapped in <Var>{expr}</Var>.
  | 'varExpr'
  // A "clean" child element (no marker / skip element / data-no-translate /
  // JSX-bearing expression anywhere in its subtree). Travels inside the T as
  // template structure — the runtime tree canonicalizes nested tags.
  | 'cleanElement'
  // Ends a run: non-clean element, fragment, or a JSX-bearing `{...}`.
  | 'boundary';

/**
 * Auto-wrap translatable JSX text runs in `<T>...</T>` (and embedded dynamic
 * expressions in `<Var>{expr}</Var>`), per arch.md section 6.
 *
 * Output fidelity: untouched source stays byte-identical — we only splice
 * wrapper tags around existing node ranges, never regenerate from the AST.
 */
export function transformAutoWrap(
  source: string,
  options: TransformAutoWrapOptions,
): TransformAutoWrapResult {
  const { filename } = options;
  const isJsxFile = filename.endsWith('.jsx') || filename.endsWith('.tsx');
  if (
    !isJsxFile ||
    (!LETTER_BEARING_JSX.test(source) &&
      !COPY_BEARING_JSX_EXPRESSION.test(source) &&
      !COPY_BEARING_JSX_ATTRIBUTE.test(source))
  ) {
    return { code: source, changed: false };
  }

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(source, {
      sourceType: 'module',
      sourceFilename: filename,
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch {
    return { code: source, changed: false };
  }

  const insertions: Insertion[] = [];
  let usedVar = false;
  let usedT = false;

  const emitVar = (node: t.Node) => {
    insertions.push({ pos: node.start!, order: ORDER_VAR_OPEN, text: '<Var>' });
    insertions.push({ pos: node.end!, order: ORDER_VAR_CLOSE, text: '</Var>' });
    usedVar = true;
  };

  // Inside a wrapped run, dynamic expressions nested in clean child elements
  // must also become <Var> — the runtime tree drops bare dynamic expressions.
  const emitVarsInElement = (el: t.JSXElement) => {
    const tagName = customElementName(el.openingElement.name);
    const hasTagHint = el.openingElement.attributes.some(
      (attr) =>
        t.isJSXAttribute(attr) &&
        t.isJSXIdentifier(attr.name) &&
        attr.name.name === 'data-autotranslate-tag',
    );
    if (tagName && !hasTagHint) {
      insertions.push({
        pos: el.openingElement.name.end!,
        order: ORDER_VAR_OPEN,
        text: ` data-autotranslate-tag="${tagName}"`,
      });
    }
    for (const child of el.children) {
      if (t.isJSXElement(child)) emitVarsInElement(child);
      else if (t.isJSXExpressionContainer(child) && isDynamicExpression(child.expression)) {
        emitVar(child);
      }
    }
  };

  const emitRun = (
    children: ReadonlyArray<t.Node>,
    members: MemberKind[],
    from: number,
    to: number,
  ) => {
    // Whitespace-only leading/trailing JSXText stays outside the T.
    let first = from;
    while (first <= to && members[first] === 'whitespace') first++;
    let last = to;
    while (last >= from && members[last] === 'whitespace') last--;
    if (first > last) return;
    insertions.push({ pos: children[first]!.start!, order: ORDER_T_OPEN, text: '<T>' });
    insertions.push({ pos: children[last]!.end!, order: ORDER_T_CLOSE, text: '</T>' });
    usedT = true;
    for (let k = first; k <= last; k++) {
      if (members[k] === 'varExpr') emitVar(children[k]!);
      else if (members[k] === 'cleanElement') emitVarsInElement(children[k] as t.JSXElement);
    }
  };

  const emitDynamicCopy = (node: t.JSXExpressionContainer) => {
    insertions.push({ pos: node.start!, order: ORDER_T_OPEN, text: '<T>' });
    insertions.push({ pos: node.end!, order: ORDER_T_CLOSE, text: '</T>' });
    usedT = true;
  };

  const recurseInto = (child: t.Node) => {
    if (t.isJSXElement(child) || t.isJSXFragment(child)) walk(child);
    else if (t.isJSXExpressionContainer(child)) {
      for (const jsx of collectTopLevelJSX(child.expression)) walk(jsx);
    }
  };

  const walk = (node: t.JSXElement | t.JSXFragment): void => {
    if (t.isJSXElement(node) && isBlockingElement(node)) return;

    // JSX passed through composition props (for example
    // `<ListPage actions={<Button>Export</Button>} />`) is not a child of the
    // outer element and Babel's root visitor correctly treats it as nested JSX.
    // Follow those expression subtrees here so they receive the same wrapping
    // as ordinary children, exactly once through their nearest JSX owner.
    if (t.isJSXElement(node)) {
      for (const attr of node.openingElement.attributes) {
        const expression =
          t.isJSXAttribute(attr) && t.isJSXExpressionContainer(attr.value)
            ? attr.value.expression
            : t.isJSXSpreadAttribute(attr)
              ? attr.argument
              : null;
        if (!expression || t.isJSXEmptyExpression(expression)) continue;
        for (const jsx of collectTopLevelJSX(expression)) walk(jsx);
      }
    }

    const children = node.children;
    const members = children.map(classifyChild);

    // Block-vs-copy guard: only wrap at levels that have direct text of their
    // own. A level whose only text sits inside child elements (e.g.
    // <div><h1>Title</h1><p>Body</p></div>) recurses instead, so separate copy
    // blocks never merge into one key.
    const hasDirectText = members.some((m) => m === 'contentText' || m === 'staticContent');
    if (!hasDirectText) {
      for (let k = 0; k < children.length; k++) {
        const child = children[k]!;
        if (isDynamicCopyContainer(child)) emitDynamicCopy(child);
        else if (members[k] === 'cleanElement' || members[k] === 'boundary') recurseInto(child);
      }
      return;
    }

    // Runs = maximal contiguous sequences of text / static / dynamic
    // expressions / clean elements. Boundaries end a run and are recursed
    // into independently (data-no-translate mid-sentence splits the T).
    for (let i = 0; i < children.length; ) {
      if (members[i] === 'boundary') {
        recurseInto(children[i]!);
        i++;
        continue;
      }
      let j = i;
      while (j < children.length && members[j] !== 'boundary') j++;
      if (runQualifies(children, members, i, j - 1)) emitRun(children, members, i, j - 1);
      i = j;
    }
  };

  // Roots = JSX with no JSX ancestor; `walk` recurses into everything reachable.
  traverse(ast, {
    JSXElement(path) {
      if (!path.findParent((p) => p.isJSXElement() || p.isJSXFragment())) walk(path.node);
      path.skip();
    },
    JSXFragment(path) {
      if (!path.findParent((p) => p.isJSXElement() || p.isJSXFragment())) walk(path.node);
      path.skip();
    },
  });

  // Attribute auto-translation runs only in client modules — `useT()` is a
  // client hook, so a host element's copy attribute can only be rewritten to
  // `attr={t("…")}` where hooks are legal. Server-component attributes are left
  // for the lint rule (see arch.md).
  const usedUseT = isClientModule(ast) ? collectAttributeInsertions(ast, insertions) : false;

  if (insertions.length === 0) return { code: source, changed: false };

  const needed = [
    ...(usedT ? ['T'] : []),
    ...(usedVar ? ['Var'] : []),
    ...(usedUseT ? ['useT'] : []),
  ];
  const importEdit = planImportEdit(ast, needed);
  if (importEdit === 'conflict') {
    console.warn(
      `autotranslate: skipped auto-wrap in ${filename} — a local binding named 'T', 'Var', or 'useT' is already in use.`,
    );
    return { code: source, changed: false };
  }
  if (importEdit) insertions.push(importEdit);

  return { code: applyInsertions(source, insertions), changed: true };
}

function isDynamicCopyContainer(node: t.Node): node is t.JSXExpressionContainer {
  return t.isJSXExpressionContainer(node) && isCopyBearingExpression(node.expression);
}

function isCopyBearingExpression(node: t.Node): boolean {
  if (t.isIdentifier(node)) return isCopyBearingName(node.name);
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    return !node.computed && t.isIdentifier(node.property) && isCopyBearingName(node.property.name);
  }
  if (t.isTSAsExpression(node) || t.isTSTypeAssertion(node) || t.isTSNonNullExpression(node)) {
    return isCopyBearingExpression(node.expression);
  }
  return false;
}

function customElementName(name: t.JSXOpeningElement['name']): string | null {
  if (t.isJSXIdentifier(name)) {
    return /^[A-Z]/.test(name.name) ? name.name : null;
  }
  if (t.isJSXMemberExpression(name)) {
    const object = customElementName(name.object);
    return object ? `${object}.${name.property.name}` : null;
  }
  return null;
}

function classifyChild(node: t.Node): MemberKind {
  if (t.isJSXText(node)) return jsxTextHasContent(node.value) ? 'contentText' : 'whitespace';
  if (t.isJSXExpressionContainer(node)) {
    const expr = node.expression;
    if (t.isJSXEmptyExpression(expr)) return 'whitespace';
    const staticValue = staticStringValue(expr);
    if (staticValue !== null) {
      return jsxTextHasContent(staticValue) ? 'staticContent' : 'staticEmpty';
    }
    if (t.isNumericLiteral(expr)) return 'staticEmpty';
    if (containsJSX(expr)) return 'boundary';
    return 'varExpr';
  }
  if (t.isJSXElement(node)) return isCleanElement(node) ? 'cleanElement' : 'boundary';
  return 'boundary';
}

/** `{'x'}` / `` {`x`} `` — the static text the runtime tree keeps verbatim. */
function staticStringValue(expr: t.Node): string | null {
  if (t.isStringLiteral(expr)) return expr.value;
  if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
    return expr.quasis[0]?.value.cooked ?? '';
  }
  return null;
}

/** Dynamic (non-static, non-empty) expression — becomes a <Var>. */
function isDynamicExpression(expr: t.Node): boolean {
  if (t.isJSXEmptyExpression(expr)) return false;
  if (staticStringValue(expr) !== null) return false;
  if (t.isNumericLiteral(expr)) return false;
  return true;
}

/**
 * "Clean" = safe to carry inside a <T> as template structure: no marker /
 * skip element / data-no-translate anywhere in the subtree, and no
 * JSXExpressionContainer whose expression contains JSX (dynamic non-JSX
 * expressions are fine — they become <Var>s). Fragments are conservatively
 * non-clean.
 */
function isCleanElement(el: t.JSXElement): boolean {
  if (isBlockingElement(el)) return false;
  for (const attr of el.openingElement.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.value?.type === 'JSXExpressionContainer' &&
      containsJSX(attr.value.expression)
    ) {
      return false;
    }
    if (attr.type === 'JSXSpreadAttribute' && containsJSX(attr.argument)) return false;
  }
  for (const child of el.children) {
    if (t.isJSXElement(child)) {
      if (!isCleanElement(child)) return false;
    } else if (t.isJSXFragment(child)) {
      return false;
    } else if (t.isJSXExpressionContainer(child) && containsJSX(child.expression)) {
      return false;
    }
  }
  return true;
}

/**
 * A run qualifies when it contains letter-bearing text anywhere — direct
 * JSXText / static strings, or text inside its clean child elements.
 */
function runQualifies(
  children: ReadonlyArray<t.Node>,
  members: MemberKind[],
  from: number,
  to: number,
): boolean {
  for (let k = from; k <= to; k++) {
    const member = members[k];
    if (member === 'contentText' || member === 'staticContent') return true;
    if (member === 'cleanElement' && elementHasText(children[k] as t.JSXElement)) return true;
  }
  return false;
}

function elementHasText(el: t.JSXElement): boolean {
  for (const child of el.children) {
    if (t.isJSXText(child) && jsxTextHasContent(child.value)) return true;
    if (t.isJSXElement(child) && elementHasText(child)) return true;
    if (t.isJSXExpressionContainer(child)) {
      const value = staticStringValue(child.expression);
      if (value !== null && jsxTextHasContent(value)) return true;
    }
  }
  return false;
}

function isBlockingElement(node: t.JSXElement): boolean {
  const name = getElementName(node);
  if (name && (TRANSLATION_MARKERS.has(name) || SKIP_ELEMENTS.has(name))) return true;
  for (const attr of node.openingElement.attributes) {
    if (
      attr.type === 'JSXAttribute' &&
      attr.name.type === 'JSXIdentifier' &&
      attr.name.name === NO_TRANSLATE_ATTRIBUTE
    ) {
      return true;
    }
  }
  return false;
}

function getElementName(node: t.JSXElement): string | null {
  const name = node.openingElement.name;
  return name.type === 'JSXIdentifier' ? name.name : null;
}

function containsJSX(node: t.Node): boolean {
  if (t.isJSXElement(node) || t.isJSXFragment(node)) return true;
  for (const key of t.VISITOR_KEYS[node.type] ?? []) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const child of value) if (isNode(child) && containsJSX(child)) return true;
    } else if (isNode(value) && containsJSX(value)) {
      return true;
    }
  }
  return false;
}

function collectTopLevelJSX(node: t.Node): Array<t.JSXElement | t.JSXFragment> {
  const out: Array<t.JSXElement | t.JSXFragment> = [];
  const visit = (current: t.Node) => {
    if (t.isJSXElement(current) || t.isJSXFragment(current)) {
      out.push(current);
      return;
    }
    for (const key of t.VISITOR_KEYS[current.type] ?? []) {
      const value = (current as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const child of value) if (isNode(child)) visit(child);
      } else if (isNode(value)) {
        visit(value);
      }
    }
  };
  visit(node);
  return out;
}

function isNode(value: unknown): value is t.Node {
  return typeof value === 'object' && value !== null && typeof (value as t.Node).type === 'string';
}

/**
 * Decide how to make the required markers (`T`, `Var`, `useT`) available from
 * `@autotranslate/react`. Returns an insertion, `null` when every needed name is
 * already imported, or `'conflict'` when a name is taken by an unrelated binding
 * (STOP condition).
 */
function planImportEdit(
  ast: ReturnType<typeof parse>,
  needed: readonly string[],
): Insertion | null | 'conflict' {
  const body = ast.program.body;
  const reactLocals = new Set<string>();
  const otherBindings = new Set<string>();
  let mergeTarget: t.ImportDeclaration | null = null;
  let lastImportEnd: number | null = null;

  for (const stmt of body) {
    if (stmt.type !== 'ImportDeclaration') {
      for (const name of declaredNames(stmt)) otherBindings.add(name);
      continue;
    }
    lastImportEnd = stmt.end!;
    const isReact = stmt.source.value === REACT_MODULE;
    for (const spec of stmt.specifiers) {
      if (isReact && spec.type === 'ImportSpecifier') reactLocals.add(spec.local.name);
      else otherBindings.add(spec.local.name);
    }
    if (isReact && !mergeTarget && stmt.specifiers.some((s) => s.type === 'ImportSpecifier')) {
      mergeTarget = stmt;
    }
  }

  const toAdd: string[] = [];
  for (const name of needed) {
    if (reactLocals.has(name)) continue;
    if (otherBindings.has(name)) return 'conflict';
    toAdd.push(name);
  }
  if (toAdd.length === 0) return null;

  if (mergeTarget) {
    const specifiers = mergeTarget.specifiers.filter((s) => s.type === 'ImportSpecifier');
    const anchor = specifiers[specifiers.length - 1]!;
    return { pos: anchor.end!, order: 0, text: `, ${toAdd.join(', ')}` };
  }

  const stmt = `import { ${toAdd.join(', ')} } from '${REACT_MODULE}';`;
  if (lastImportEnd !== null) return { pos: lastImportEnd, order: 0, text: `\n${stmt}` };
  const lastDirective = ast.program.directives.at(-1);
  if (lastDirective?.end != null) {
    return { pos: lastDirective.end, order: 0, text: `\n${stmt}` };
  }
  return { pos: 0, order: 0, text: `${stmt}\n` };
}

function declaredNames(stmt: t.Statement): string[] {
  const decl =
    stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration'
      ? stmt.declaration
      : stmt;
  if (!decl) return [];
  if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
    return decl.id ? [decl.id.name] : [];
  }
  if (decl.type === 'VariableDeclaration') {
    return decl.declarations.flatMap((d) => (d.id.type === 'Identifier' ? [d.id.name] : []));
  }
  return [];
}

function applyInsertions(source: string, insertions: Insertion[]): string {
  const sorted = [...insertions].sort((a, b) => a.pos - b.pos || a.order - b.order);
  let out = '';
  let cursor = 0;
  for (const ins of sorted) {
    out += source.slice(cursor, ins.pos);
    out += ins.text;
    cursor = ins.pos;
  }
  return out + source.slice(cursor);
}

// ---------------------------------------------------------------------------
// Attribute auto-translation (mode: 'auto', client modules only)
//
// Rewrites a host element's copy-bearing string attribute
//   <input placeholder="Search cases" />
// into
//   <input placeholder={t("Search cases")} />
// and ensures a `const t = useT()` binding exists at the top of the enclosing
// component/hook. `useT` is a client hook, so this only runs in files carrying a
// `"use client"` directive; server-component attributes are left for the lint
// rule. Custom-component copy props (`<Field placeholder=…>`) are untouched —
// the extractor's includeAutoCopy path owns those.
// ---------------------------------------------------------------------------

interface FunctionBinding {
  readonly binding: string;
  readonly needsInjection: boolean;
  readonly injectPos: number;
  readonly injectText: string;
}

/** True when the module opens with a `"use client"` directive. */
function isClientModule(ast: ReturnType<typeof parse>): boolean {
  return ast.program.directives.some((directive) => directive.value.value === 'use client');
}

function collectAttributeInsertions(
  ast: ReturnType<typeof parse>,
  insertions: Insertion[],
): boolean {
  const funcBindings = new Map<t.Node, FunctionBinding>();

  traverse(ast, {
    JSXAttribute(path) {
      const node = path.node;
      // Name must be a plain identifier that carries copy.
      if (!t.isJSXIdentifier(node.name) || !isTranslatableAttribute(node.name.name)) return;
      // Value must be a plain string literal with visible content.
      if (!t.isStringLiteral(node.value) || !jsxTextHasContent(node.value.value)) return;

      // Element must be a host element (lowercase tag), not a skip/marker
      // element, and not under data-no-translate.
      const openingPath = path.parentPath;
      if (!openingPath?.isJSXOpeningElement() || !isHostElementName(openingPath.node.name)) return;
      const elementPath = openingPath.parentPath;
      if (!elementPath?.isJSXElement()) return;
      if (isBlockingElement(elementPath.node)) return;
      if (hasBlockingJSXAncestor(elementPath)) return;

      // Resolve the enclosing component/hook (block-bodied) that will own the
      // `useT()` binding. Nested closures reference the component-scope binding.
      const hostFn = findHostFunction(path);
      if (!hostFn) return;
      const info = resolveBinding(hostFn, funcBindings);

      const value = node.value;
      insertions.push({ pos: value.start!, order: ORDER_ATTR_OPEN, text: `{${info.binding}(` });
      insertions.push({ pos: value.end!, order: ORDER_ATTR_CLOSE, text: ')}' });
    },
  });

  let injected = false;
  for (const info of funcBindings.values()) {
    if (info.needsInjection) {
      insertions.push({ pos: info.injectPos, order: ORDER_INJECT, text: info.injectText });
      injected = true;
    }
  }
  return injected;
}

function isHostElementName(name: t.JSXOpeningElement['name']): boolean {
  return t.isJSXIdentifier(name) && /^[a-z]/.test(name.name);
}

function hasBlockingJSXAncestor(path: NodePath): boolean {
  return Boolean(
    path.findParent((parent) => parent.isJSXElement() && isBlockingElement(parent.node)),
  );
}

/**
 * Nearest enclosing function that is a React component or hook (`/^[A-Z]/` or
 * `/^use[A-Z]/`) AND has a block body a statement can be injected into. Returns
 * `null` when none is found — the attribute is then left for the lint rule.
 */
function findHostFunction(path: NodePath): NodePath<t.Function> | null {
  let fn = path.getFunctionParent();
  while (fn) {
    if (t.isBlockStatement(fn.node.body) && functionComponentName(fn) !== null) return fn;
    fn = fn.getFunctionParent();
  }
  return null;
}

/** Component/hook name of a function path, or `null` when it is neither. */
function functionComponentName(fn: NodePath<t.Function>): string | null {
  const node = fn.node;
  let name: string | null = null;
  if (t.isFunctionDeclaration(node) && node.id) {
    name = node.id.name;
  } else if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    const parent = fn.parentPath?.node;
    if (parent && t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
      name = parent.id.name;
    } else if (t.isFunctionExpression(node) && node.id) {
      name = node.id.name;
    }
  }
  if (!name) return null;
  return /^[A-Z]/.test(name) || /^use[A-Z]/.test(name) ? name : null;
}

/** Reuse an in-scope `useT()` binding, or plan the injection of a fresh one. */
function resolveBinding(
  fn: NodePath<t.Function>,
  cache: Map<t.Node, FunctionBinding>,
): FunctionBinding {
  const existing = cache.get(fn.node);
  if (existing) return existing;

  for (const name of Object.keys(fn.scope.bindings)) {
    const declarator = fn.scope.bindings[name]?.path.node;
    if (declarator && t.isVariableDeclarator(declarator) && isUseTCall(declarator.init)) {
      const info: FunctionBinding = {
        binding: name,
        needsInjection: false,
        injectPos: 0,
        injectText: '',
      };
      cache.set(fn.node, info);
      return info;
    }
  }

  const body = fn.node.body as t.BlockStatement;
  const binding = pickBindingName(fn);
  const info: FunctionBinding = {
    binding,
    needsInjection: true,
    injectPos: body.start! + 1,
    injectText: `\n  const ${binding} = useT();`,
  };
  cache.set(fn.node, info);
  return info;
}

function isUseTCall(node: t.Node | null | undefined): boolean {
  return Boolean(
    node && t.isCallExpression(node) && t.isIdentifier(node.callee) && node.callee.name === 'useT',
  );
}

function pickBindingName(fn: NodePath<t.Function>): string {
  for (const candidate of ['t', '__t', '__attrT']) {
    if (!fn.scope.hasBinding(candidate)) return candidate;
  }
  let index = 2;
  while (fn.scope.hasBinding(`__t${index}`)) index++;
  return `__t${index}`;
}
