import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type * as t from '@babel/types';

// @babel/traverse ships an ESM-incompatible default export.
const traverse = (_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse;

export type Framework = 'next' | 'vite';
export type Provider = 'anthropic' | 'openai' | 'google' | 'deepl' | 'stub';
export type StepStatus = 'done' | 'already-configured' | 'skipped';

export interface StepResult {
  readonly status: StepStatus;
  readonly label: string;
  readonly detail?: string;
  readonly diff?: string;
}

export interface InitOptions {
  readonly cwd?: string;
  readonly framework?: Framework;
  readonly targets?: string[];
  readonly provider?: Provider;
  readonly force?: boolean | undefined;
}

export interface InitResult {
  readonly framework: Framework | null;
  readonly steps: StepResult[];
}

interface ProviderEmit {
  readonly code: string;
  readonly hint: string;
}

function buildProviderEmit(provider: Provider): ProviderEmit {
  switch (provider) {
    case 'anthropic':
      return {
        code: "{ name: 'ai', model: 'anthropic:claude-haiku-4-5', apiKey: process.env.ANTHROPIC_API_KEY }",
        hint: 'provider: anthropic - key read from ANTHROPIC_API_KEY',
      };
    case 'openai':
      return {
        code: "{ name: 'ai', model: 'openai:gpt-4o-mini', apiKey: process.env.OPENAI_API_KEY }",
        hint: 'provider: openai - key read from OPENAI_API_KEY',
      };
    case 'google':
      return {
        code: "{ name: 'ai', model: 'google:gemini-2.0-flash', apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY }",
        hint: 'provider: google - key read from GOOGLE_GENERATIVE_AI_API_KEY',
      };
    case 'deepl':
      return {
        code: "{ name: 'deepl', apiKey: process.env.DEEPL_API_KEY }",
        hint: 'provider: deepl - key read from DEEPL_API_KEY',
      };
    case 'stub':
      return { code: "{ name: 'stub' }", hint: 'provider: stub' };
  }
}

function buildConfigTemplate(targets: string[], provider: Provider): string {
  const { code: providerCode } = buildProviderEmit(provider);
  return `import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: [${targets.map((locale) => `'${locale}'`).join(', ')}],
  content: ['src/**/*.{ts,tsx,js,jsx}'],
  provider: ${providerCode},
});
`;
}

async function detectFramework(cwd: string): Promise<Framework | null> {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const content = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    if ('next' in all) return 'next';
    if ('vite' in all) return 'vite';
    return null;
  } catch {
    return null;
  }
}

async function stepWriteConfig(
  cwd: string,
  targets: string[],
  provider: Provider,
  force: boolean,
): Promise<StepResult> {
  const path = join(cwd, 'autotranslate.config.ts');
  const { hint } = buildProviderEmit(provider);

  if (existsSync(path) && !force) {
    return { status: 'already-configured', label: 'autotranslate.config.ts already exists' };
  }

  await writeFile(path, buildConfigTemplate(targets, provider), 'utf8');
  return { status: 'done', label: 'autotranslate.config.ts written', detail: `(${hint})` };
}

const NEXT_CONFIG_NAMES = ['next.config.ts', 'next.config.mjs', 'next.config.js'] as const;

function buildManualWrapDiff(configName: string): string {
  return [
    `// 1. Add this import at the top of ${configName}:`,
    `import { withAutotranslate } from '@autotranslate/next/plugin';`,
    ``,
    `// 2. Wrap the default export:`,
    `//    Before: export default yourNextConfig;`,
    `//    After:  export default withAutotranslate(yourNextConfig);`,
  ].join('\n');
}

async function stepWrapNextConfig(cwd: string): Promise<StepResult> {
  let configPath: string | null = null;
  for (const name of NEXT_CONFIG_NAMES) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) {
      configPath = candidate;
      break;
    }
  }

  if (!configPath) {
    return {
      status: 'skipped',
      label: 'next.config: not found - create it then re-run init',
    };
  }

  const configName = basename(configPath);
  const original = await readFile(configPath, 'utf8');

  if (original.includes('withAutotranslate')) {
    return {
      status: 'already-configured',
      label: `${configName} already wrapped in withAutotranslate`,
    };
  }

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(original, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });
  } catch {
    return {
      status: 'skipped',
      label: `${configName}: parse failed`,
      diff: buildManualWrapDiff(configName),
    };
  }

  let exportDefault: t.ExportDefaultDeclaration | null = null;
  let lastImportEnd = 0;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.end != null) lastImportEnd = path.node.end;
    },
    ExportDefaultDeclaration(path) {
      exportDefault = path.node;
      path.stop();
    },
  });

  if (!exportDefault) {
    return {
      status: 'skipped',
      label: `${configName}: no recognizable default export`,
      diff: buildManualWrapDiff(configName),
    };
  }

  const decl = exportDefault as t.ExportDefaultDeclaration;
  const declNode = decl.declaration;

  if (declNode.start == null || declNode.end == null) {
    return {
      status: 'skipped',
      label: `${configName}: could not determine declaration range`,
      diff: buildManualWrapDiff(configName),
    };
  }

  const declStart = declNode.start;
  const declEnd = declNode.end;

  // Positions before declStart are unchanged, so lastImportEnd is still valid.
  let result =
    original.slice(0, declStart) +
    'withAutotranslate(' +
    original.slice(declStart, declEnd) +
    ')' +
    original.slice(declEnd);

  const importLine = "import { withAutotranslate } from '@autotranslate/next/plugin';\n";
  if (lastImportEnd === 0) {
    result = importLine + result;
  } else {
    // lastImportEnd is the position right after the last import's semicolon.
    // The '\n' following it is at original[lastImportEnd], so we prepend '\n'
    // to put our import on its own line.
    result = `${result.slice(0, lastImportEnd)}\n${importLine}${result.slice(lastImportEnd)}`;
  }

  await writeFile(configPath, result, 'utf8');
  return {
    status: 'done',
    label: `${configName} wrapped in withAutotranslate`,
    detail: '(AST edit)',
  };
}

function buildProxyTemplate(source: string, targets: string[]): string {
  const allLocales = [source, ...targets];
  const localeList = allLocales.map((locale) => `'${locale}'`).join(', ');
  // In the template literal below, \\\\ produces \\ in the string value, which
  // when written to disk appears as \\ - the two-char escape sequence \\. in the
  // generated JS/TS file represents a literal backslash+period for the regex.
  return [
    `import { createNextMiddleware } from '@autotranslate/next/middleware';`,
    ``,
    `export default createNextMiddleware({`,
    `  defaultLocale: '${source}',`,
    `  locales: [${localeList}],`,
    `});`,
    ``,
    `export const config = {`,
    `  matcher: ['/((?!api|_next|.*\\\\..*).*)'],`,
    `};`,
    ``,
  ].join('\n');
}

async function stepCreateProxy(
  cwd: string,
  source: string,
  targets: string[],
): Promise<StepResult> {
  const hasSrc = existsSync(join(cwd, 'src'));
  const proxyRelPath = hasSrc ? 'src/proxy.ts' : 'proxy.ts';
  const proxyPath = join(cwd, proxyRelPath);

  if (existsSync(proxyPath)) {
    return { status: 'already-configured', label: `${proxyRelPath} already exists` };
  }

  if (hasSrc) {
    await mkdir(join(cwd, 'src'), { recursive: true });
  }

  await writeFile(proxyPath, buildProxyTemplate(source, targets), 'utf8');
  return {
    status: 'done',
    label: `${proxyRelPath} created`,
    detail: '(path-prefix locale routing)',
  };
}

function stepViteDiff(): StepResult {
  const diff = [
    `// In vite.config.ts, add the autotranslate plugin:`,
    `import { autotranslate } from '@autotranslate/vite';`,
    ``,
    `export default defineConfig({`,
    `  plugins: [autotranslate()],`,
    `});`,
  ].join('\n');
  return {
    status: 'skipped',
    label: 'vite.config: add autotranslate plugin',
    detail: '(manual - never AST-edit vite configs)',
    diff,
  };
}

// Strip // line comments and block comments outside of string values.
function stripJsonComments(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '"') {
      // String: copy verbatim until closing unescaped "
      result += text[i++];
      while (i < text.length) {
        if (text[i] === '\\') {
          result += text[i++];
          if (i < text.length) result += text[i++];
        } else if (text[i] === '"') {
          result += text[i++];
          break;
        } else {
          result += text[i++];
        }
      }
    } else if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (text[i] === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
    } else {
      result += text[i++];
    }
  }
  return result;
}

/**
 * Find the "include" array in `original` and insert `entry` at the end.
 * Returns the modified text, or null if the array could not be located.
 */
function insertIntoTsconfigInclude(original: string, entry: string): string | null {
  const includeRe = /"include"\s*:\s*\[/;
  const match = includeRe.exec(original);
  if (!match) return null;

  const arrayOpenPos = match.index + match[0].length - 1;

  let depth = 0;
  let pos = arrayOpenPos;
  while (pos < original.length) {
    const ch = original[pos];
    if (ch === '[') {
      depth++;
    } else if (ch === ']') {
      depth--;
      if (depth === 0) break;
    } else if (ch === '"') {
      pos++;
      while (pos < original.length && original[pos] !== '"') {
        if (original[pos] === '\\') pos++;
        pos++;
      }
    }
    pos++;
  }

  if (depth !== 0) return null;
  const closingBracketPos = pos;

  let lastContentPos = closingBracketPos - 1;
  while (lastContentPos > arrayOpenPos && /\s/.test(original[lastContentPos] ?? '')) {
    lastContentPos--;
  }

  if (lastContentPos === arrayOpenPos) {
    // Empty array: just insert the entry.
    return `${original.slice(0, arrayOpenPos + 1)}"${entry}"${original.slice(closingBracketPos)}`;
  }

  const hasTrailingComma = original[lastContentPos] === ',';
  const insertPoint = lastContentPos + 1;
  const arrayContent = original.slice(arrayOpenPos + 1, closingBracketPos);
  const isMultiline = arrayContent.includes('\n');

  let separator: string;
  if (isMultiline) {
    const indentMatch = /\n(\s+)/.exec(arrayContent);
    const indent = indentMatch ? indentMatch[1] : '    ';
    separator = hasTrailingComma ? `\n${indent}` : `,\n${indent}`;
  } else {
    separator = hasTrailingComma ? ' ' : ', ';
  }

  return `${original.slice(0, insertPoint) + separator}"${entry}"${original.slice(insertPoint)}`;
}

async function stepUpdateTsconfig(cwd: string, outDir: string): Promise<StepResult> {
  const tsConfigPath = join(cwd, 'tsconfig.json');
  const entry = `${outDir}/types.d.ts`;

  if (!existsSync(tsConfigPath)) {
    return {
      status: 'skipped',
      label: 'tsconfig.json not found',
      diff: `// Add "${entry}" to the include array in tsconfig.json`,
    };
  }

  const original = await readFile(tsConfigPath, 'utf8');

  let parsed: { include?: string[] };
  try {
    parsed = JSON.parse(stripJsonComments(original)) as { include?: string[] };
  } catch {
    return {
      status: 'skipped',
      label: 'tsconfig.json: could not parse',
      diff: `// Add "${entry}" to the include array in tsconfig.json`,
    };
  }

  if (parsed.include?.some((p) => p === entry || p.endsWith('/types.d.ts'))) {
    return { status: 'already-configured', label: 'tsconfig.json include already has types.d.ts' };
  }

  if (!('include' in parsed)) {
    // No include array yet - add one before the final closing brace.
    const lastBrace = original.lastIndexOf('}');
    if (lastBrace === -1) {
      return {
        status: 'skipped',
        label: 'tsconfig.json: malformed (no closing brace)',
        diff: `// Add "${entry}" to the include array in tsconfig.json`,
      };
    }
    // Determine if a trailing comma is needed before the new key.
    const precedingContent = original.slice(0, lastBrace).trimEnd();
    const needsComma = !precedingContent.endsWith('{') && !precedingContent.endsWith(',');
    const prefix = needsComma ? ',\n' : '\n';
    const result =
      original.slice(0, lastBrace) +
      `${prefix}  "include": ["${entry}"]\n` +
      original.slice(lastBrace);
    await writeFile(tsConfigPath, result, 'utf8');
    return { status: 'done', label: `tsconfig.json: added ${entry} to include` };
  }

  const modified = insertIntoTsconfigInclude(original, entry);
  if (!modified) {
    return {
      status: 'skipped',
      label: 'tsconfig.json: could not locate include array to modify',
      diff: `// Add "${entry}" to the include array in tsconfig.json`,
    };
  }

  await writeFile(tsConfigPath, modified, 'utf8');
  return { status: 'done', label: `tsconfig.json: added ${entry} to include` };
}

/**
 * Everything under `outDir` is committed - the catalogs AND `.state/`, which
 * records the source hash each translation was produced from. That state is
 * the diff input: ignoring it makes every fresh clone and every CI run
 * retranslate the whole catalog. Older versions ignored `<outDir>/.cache/`,
 * so drop that line if it is still there.
 */
async function stepUpdateGitignore(cwd: string, outDir: string): Promise<StepResult> {
  const gitignorePath = join(cwd, '.gitignore');
  const legacyEntry = `${outDir}/.cache/`;

  if (!existsSync(gitignorePath)) {
    return { status: 'already-configured', label: '.gitignore: nothing to ignore' };
  }

  const content = await readFile(gitignorePath, 'utf8');
  const lines = content.split('\n');
  if (!lines.some((line) => line.trim() === legacyEntry)) {
    return { status: 'already-configured', label: '.gitignore: nothing to ignore' };
  }

  const kept = lines.filter((line) => line.trim() !== legacyEntry);
  // Drop the "# autotranslate" header too if it now heads nothing.
  const cleaned = kept
    .filter((line, i) => {
      if (line.trim() !== '# autotranslate') return true;
      const next = kept[i + 1]?.trim();
      return next !== undefined && next !== '';
    })
    .join('\n');
  await writeFile(gitignorePath, cleaned, 'utf8');

  return {
    status: 'done',
    label: `.gitignore: removed ${legacyEntry} (translation state must be committed)`,
  };
}

const MERGE_DRIVER_NAME = 'autotranslate';

/**
 * Catalogs and translation state are committed, so parallel branches will edit
 * the same generated JSON. Git's line-based merge conflicts on adjacent keys
 * and writes conflict markers into JSON, which breaks every consumer. Register
 * a key-wise merge driver instead.
 *
 * `.gitattributes` is committed so the whole team gets the routing; the driver
 * command itself lives in `.git/config`, which git deliberately does not share.
 * Teammates enable it by running `autotranslate init` (or the printed command).
 */
async function stepConfigureMergeDriver(cwd: string, outDir: string): Promise<StepResult> {
  const attributesPath = join(cwd, '.gitattributes');
  const rules = [
    `${outDir}/**/*.json merge=${MERGE_DRIVER_NAME}`,
    `${outDir}/.meta.json merge=${MERGE_DRIVER_NAME}`,
    `${outDir}/index.ts merge=${MERGE_DRIVER_NAME}`,
  ];
  const configCommand = `git config merge.${MERGE_DRIVER_NAME}.driver 'npx autotranslate merge-driver %O %A %B %P'`;

  const existing = existsSync(attributesPath) ? await readFile(attributesPath, 'utf8') : '';
  const lines = existing.split('\n').map((l) => l.trim());
  const missing = rules.filter((rule) => !lines.includes(rule));

  const configured = await configureGitMergeDriver(cwd);

  if (missing.length === 0) {
    return {
      status: configured ? 'already-configured' : 'skipped',
      label: `.gitattributes already routes ${outDir} through the ${MERGE_DRIVER_NAME} merge driver`,
      ...(configured ? {} : { detail: `run: ${configCommand}` }),
    };
  }

  const prefix = existing === '' ? '' : existing.endsWith('\n') ? existing : `${existing}\n`;
  await writeFile(
    attributesPath,
    `${prefix}\n# autotranslate: merge generated catalogs by key, not by line\n${missing.join('\n')}\n`,
    'utf8',
  );

  return {
    status: 'done',
    label: `.gitattributes: routed ${outDir} through the ${MERGE_DRIVER_NAME} merge driver`,
    ...(configured
      ? { detail: 'teammates must run `autotranslate init` once to enable it locally' }
      : { detail: `not a git repo yet - after \`git init\`, run: ${configCommand}` }),
  };
}

/** Registers the driver in the local `.git/config`. Returns false outside a repo. */
async function configureGitMergeDriver(cwd: string): Promise<boolean> {
  const { execFile } = await import('node:child_process');
  const run = (args: string[]): Promise<boolean> =>
    new Promise((resolve) => {
      execFile('git', args, { cwd }, (error) => resolve(!error));
    });

  if (!(await run(['rev-parse', '--git-dir']))) return false;
  const ok = await run([
    'config',
    `merge.${MERGE_DRIVER_NAME}.driver`,
    'npx autotranslate merge-driver %O %A %B %P',
  ]);
  if (!ok) return false;
  return run(['config', `merge.${MERGE_DRIVER_NAME}.name`, 'autotranslate catalog merge']);
}

function buildLayoutDiff(source: string, targets: string[], outDir: string): string {
  const allLocales = [source, ...targets];
  const supportedLocalesStr = allLocales.map((locale) => `'${locale}'`).join(', ');
  return [
    `// app/[lang]/layout.tsx`,
    `import * as catalogModule from '../../${outDir}';`,
    `import { getT } from '@autotranslate/next';`,
    `import { TranslationProvider } from '@autotranslate/react';`,
    `import { notFound } from 'next/navigation';`,
    `import type { ReactNode } from 'react';`,
    ``,
    `const SUPPORTED_LOCALES = [${supportedLocalesStr}] as const;`,
    `type Locale = (typeof SUPPORTED_LOCALES)[number];`,
    `const hasLocale = (v: string): v is Locale =>`,
    `  (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(v);`,
    ``,
    `export async function generateStaticParams() {`,
    `  return SUPPORTED_LOCALES.map((lang) => ({ lang }));`,
    `}`,
    ``,
    `export default async function LangLayout({`,
    `  children,`,
    `  params,`,
    `}: {`,
    `  children: ReactNode;`,
    `  params: Promise<{ lang: string }>;`,
    `}) {`,
    `  const { lang } = await params;`,
    `  if (!hasLocale(lang)) notFound();`,
    ``,
    `  const catalog = await catalogModule.loadCatalog(lang);`,
    `  const fallback = await catalogModule.loadCatalog('${source}');`,
    ``,
    `  return (`,
    `    <html lang={lang}>`,
    `      <body>`,
    `        <TranslationProvider locale={lang} catalog={catalog} fallback={fallback}>`,
    `          {children}`,
    `        </TranslationProvider>`,
    `      </body>`,
    `    </html>`,
    `  );`,
    `}`,
  ].join('\n');
}

/**
 * Non-interactive init: scaffolds autotranslate for the current project.
 * Each step is idempotent and reports done / already-configured / skipped.
 */
export async function init(options: InitOptions = {}): Promise<InitResult> {
  const cwd = options.cwd ?? process.cwd();
  const provider = options.provider ?? 'anthropic';
  const targets = options.targets ?? ['es', 'fr', 'ja'];
  const force = options.force ?? false;
  const source = 'en';
  const outDir = '.translations';

  const framework = options.framework ?? (await detectFramework(cwd));

  const steps: StepResult[] = [];

  steps.push(await stepWriteConfig(cwd, targets, provider, force));

  if (framework === 'next') {
    steps.push(await stepWrapNextConfig(cwd));
    steps.push(await stepCreateProxy(cwd, source, targets));
  } else if (framework === 'vite') {
    steps.push(stepViteDiff());
  }

  steps.push(await stepUpdateTsconfig(cwd, outDir));

  steps.push(await stepUpdateGitignore(cwd, outDir));

  steps.push(await stepConfigureMergeDriver(cwd, outDir));

  if (framework === 'next') {
    steps.push({
      status: 'skipped',
      label: 'app/[lang]/layout.tsx',
      detail: '(manual diff - layout too custom to edit safely)',
      diff: buildLayoutDiff(source, targets, outDir),
    });
  }

  return { framework, steps };
}
