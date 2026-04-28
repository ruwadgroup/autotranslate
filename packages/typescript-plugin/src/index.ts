import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type tsModule from 'typescript/lib/tsserverlibrary';

interface PluginConfig {
  readonly outDir?: string;
  readonly source?: string;
  readonly severity?: 'error' | 'warning' | 'suggestion';
}

const TRANSLATOR_BINDINGS = new Set(['useT', 't', 'useTranslations']);
const STANDALONE_T_SOURCES = new Set(['@autotranslate/core/t', '@autotranslate/core/standalone']);
const REACT_HOOK_SOURCES = new Set(['@autotranslate/react']);
const CACHE_TTL_MS = 2_000;
const DIAGNOSTIC_CODE = 99001;

const init: tsModule.server.PluginModuleFactory = ({ typescript: ts }) => ({
  create(info) {
    const proxy: tsModule.LanguageService = Object.create(null);
    for (const k of Object.keys(info.languageService) as Array<keyof tsModule.LanguageService>) {
      const fn = info.languageService[k];
      // biome-ignore lint/suspicious/noExplicitAny: dynamic LS proxy
      (proxy as any)[k] = (...args: unknown[]) => (fn as any).apply(info.languageService, args);
    }

    const config = (info.config ?? {}) as PluginConfig;
    const outDir = config.outDir ?? '.translations';
    const sourceLocale = config.source ?? 'en';
    const category = pickCategory(ts, config.severity ?? 'warning');
    const projectRoot = info.project.getCurrentDirectory();

    let cachedKeys: Set<string> | undefined;
    let cacheStamp = 0;

    const readCatalogKeys = (): Set<string> => {
      const now = Date.now();
      if (cachedKeys && now - cacheStamp < CACHE_TTL_MS) return cachedKeys;
      cacheStamp = now;
      const keys = new Set<string>();
      const localeDir = resolve(projectRoot, outDir, sourceLocale);
      if (existsSync(localeDir) && statSync(localeDir).isDirectory()) {
        for (const file of walkJsonFiles(localeDir)) {
          mergeKeys(keys, file);
        }
      } else {
        const flat = resolve(projectRoot, outDir, `${sourceLocale}.json`);
        if (existsSync(flat)) mergeKeys(keys, flat);
      }
      cachedKeys = keys;
      return keys;
    };

    proxy.getSemanticDiagnostics = (fileName) => {
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
            if (literal && !known.has(literal) && !literal.startsWith('t.')) {
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

    return proxy;
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

function mergeKeys(out: Set<string>, file: string): void {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    for (const key of Object.keys(data)) out.add(key);
  } catch {
    // skip malformed
  }
}

// tsserver loads plugins via `require()` and expects the factory as the
// module's direct export. Assigning to `module.exports` (instead of using
// `export =`) keeps this file portable across ESM and CJS tsconfig targets.
module.exports = init;
