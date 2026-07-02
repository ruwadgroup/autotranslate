import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type * as tsModule from 'typescript';

interface PluginConfig {
  readonly outDir?: string;
  readonly source?: string;
  readonly severity?: 'error' | 'warning' | 'suggestion';
  readonly locale?: string;
}

const TRANSLATOR_BINDINGS = new Set(['useT', 't']);
const STANDALONE_T_SOURCES = new Set(['@autotranslate/core/t', '@autotranslate/core/standalone']);
const REACT_HOOK_SOURCES = new Set(['@autotranslate/react']);
const CACHE_TTL_MS = 2_000;
const DIAGNOSTIC_CODE = 99001;
const HINT_MAX_LEN = 40;

// Byte-identical to core's shortHash. Kept local because tsserver loads this
// plugin from places where @autotranslate/core may not resolve (non-hoisted
// pnpm workspaces), and bundling core in would bloat the plugin.
function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

const init: tsModule.server.PluginModuleFactory = ({ typescript: ts }) => ({
  create(info) {
    const config = (info.config ?? {}) as PluginConfig;
    const outDir = config.outDir ?? '.translations';
    const sourceLocale = config.source ?? 'en';
    const category = pickCategory(ts, config.severity ?? 'warning');
    const projectRoot = info.project.getCurrentDirectory();

    const catalogCache = new Map<string, { record: Record<string, string>; stamp: number }>();

    const readCatalog = (locale: string): Record<string, string> => {
      const now = Date.now();
      const entry = catalogCache.get(locale);
      if (entry && now - entry.stamp < CACHE_TTL_MS) return entry.record;
      const record: Record<string, string> = {};
      const localeDir = resolve(projectRoot, outDir, locale);
      if (existsSync(localeDir) && statSync(localeDir).isDirectory()) {
        for (const file of walkJsonFiles(localeDir)) {
          mergeRecord(record, file);
        }
      }
      catalogCache.set(locale, { record, stamp: now });
      return record;
    };

    const readCatalogKeys = (): Set<string> => new Set(Object.keys(readCatalog(sourceLocale)));

    // Alphabetically-first non-source locale directory under <projectRoot>/<outDir>.
    // Config can override with an explicit locale string.
    const getDisplayLocale = (): string => {
      if (config.locale) return config.locale;
      try {
        const outDirAbs = resolve(projectRoot, outDir);
        if (!existsSync(outDirAbs)) return sourceLocale;
        const dirs = readdirSync(outDirAbs, { withFileTypes: true })
          .filter((e) => e.isDirectory() && e.name !== sourceLocale)
          .map((e) => e.name)
          .sort();
        return dirs[0] ?? sourceLocale;
      } catch {
        return sourceLocale;
      }
    };

    const getSemanticDiagnostics = (fileName: string): tsModule.Diagnostic[] => {
      const prior = info.languageService.getSemanticDiagnostics(fileName);
      const program = info.languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      if (!sourceFile) return prior;

      const known = readCatalogKeys();
      if (known.size === 0) return prior;

      const tracked = collectTrackedBindings(ts, sourceFile);
      if (tracked.size === 0) return prior;

      const extra: tsModule.Diagnostic[] = [];
      const visit = (node: tsModule.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          tracked.has(node.expression.text) &&
          node.arguments.length > 0
        ) {
          const first = node.arguments[0];
          if (first && ts.isStringLiteralLike(first)) {
            const literal = first.text;
            // Catalog stores hash12 of the source string. Plain-string keys
            // produced by the extractor are 12-hex shortHash digests; tree
            // keys carry the `t.` prefix and are skipped (they're never
            // expressed as raw `t('...')` literals in user code).
            if (literal && !known.has(shortHash(literal)) && !literal.startsWith('t.')) {
              extra.push({
                file: sourceFile,
                start: first.getStart(),
                length: first.getWidth(),
                messageText: `[autotranslate] Key not in catalog: "${literal}". Run \`autotranslate extract && translate\` or check for typos.`,
                category,
                code: DIAGNOSTIC_CODE,
                source: '@autotranslate',
              });
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      return [...prior, ...extra];
    };

    const provideInlayHints = (
      fileName: string,
      span: tsModule.TextSpan,
      preferences: tsModule.UserPreferences,
    ): tsModule.InlayHint[] => {
      const prior = info.languageService.provideInlayHints
        ? info.languageService.provideInlayHints(fileName, span, preferences)
        : [];

      const program = info.languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      if (!sourceFile) return prior;

      const tracked = collectTrackedBindings(ts, sourceFile);
      if (tracked.size === 0) return prior;

      const displayLocale = getDisplayLocale();
      const catalog = readCatalog(displayLocale);
      if (Object.keys(catalog).length === 0) return prior;

      const hints: tsModule.InlayHint[] = [];
      const spanEnd = span.start + span.length;

      const visit = (node: tsModule.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          tracked.has(node.expression.text) &&
          node.arguments.length > 0
        ) {
          const callEnd = node.getEnd();
          if (callEnd >= span.start && callEnd <= spanEnd) {
            const first = node.arguments[0];
            if (first && ts.isStringLiteralLike(first)) {
              const literal = first.text;
              if (literal && !literal.startsWith('t.')) {
                const key = shortHash(literal);
                const translation = catalog[key];
                if (translation !== undefined) {
                  let displayText = translation;
                  if (displayText.length > HINT_MAX_LEN) {
                    displayText = `${displayText.slice(0, HINT_MAX_LEN)}…`;
                  }
                  hints.push({
                    text: `» ${displayText}`,
                    position: callEnd,
                    kind: ts.InlayHintKind.Type,
                    whitespaceBefore: true,
                  });
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);

      return [...prior, ...hints];
    };

    // Decorator pattern: forward every method to the host's language service,
    // override `getSemanticDiagnostics` and `provideInlayHints`. A Proxy keeps
    // `this` correctly bound on internal calls without manually iterating method names.
    return new Proxy(info.languageService, {
      get(target, prop, receiver) {
        if (prop === 'getSemanticDiagnostics') return getSemanticDiagnostics;
        if (prop === 'provideInlayHints') return provideInlayHints;
        return Reflect.get(target, prop, receiver);
      },
    });
  },
});

function pickCategory(
  ts: typeof tsModule,
  severity: 'error' | 'warning' | 'suggestion',
): tsModule.DiagnosticCategory {
  if (severity === 'error') return ts.DiagnosticCategory.Error;
  if (severity === 'suggestion') return ts.DiagnosticCategory.Suggestion;
  return ts.DiagnosticCategory.Warning;
}

function collectTrackedBindings(ts: typeof tsModule, sourceFile: tsModule.SourceFile): Set<string> {
  const tracked = new Set<string>();

  ts.forEachChild(sourceFile, (node) => {
    if (!ts.isImportDeclaration(node)) return;
    if (!ts.isStringLiteral(node.moduleSpecifier)) return;
    const moduleName = node.moduleSpecifier.text;
    if (!STANDALONE_T_SOURCES.has(moduleName) && !REACT_HOOK_SOURCES.has(moduleName)) return;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return;
    for (const spec of bindings.elements) {
      const importedName = (spec.propertyName ?? spec.name).text;
      if (TRANSLATOR_BINDINGS.has(importedName)) tracked.add(spec.name.text);
    }
  });

  // Follow `const t = useT()` so call-sites of the alias are checked.
  const visit = (node: tsModule.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      tracked.has(node.initializer.expression.text) &&
      ts.isIdentifier(node.name)
    ) {
      tracked.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);

  return tracked;
}

function walkJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function mergeRecord(out: Record<string, string>, file: string): void {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') out[k] = v;
    }
  } catch {
    // skip malformed
  }
}

// tsserver loads plugins via `require()` and expects the factory as the
// module's direct export. Assigning to `module.exports` (instead of using
// `export =`) keeps this file portable across ESM and CJS tsconfig targets.
module.exports = init;
