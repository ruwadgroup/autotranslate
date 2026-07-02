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

async function stepUpdateGitignore(cwd: string, outDir: string): Promise<StepResult> {
  const gitignorePath = join(cwd, '.gitignore');
  const cacheEntry = `${outDir}/.cache/`;

  if (existsSync(gitignorePath)) {
    const content = await readFile(gitignorePath, 'utf8');
    if (content.split('\n').some((line) => line.trim() === cacheEntry)) {
      return { status: 'already-configured', label: `.gitignore already has ${cacheEntry}` };
    }
    const newContent = content.endsWith('\n')
      ? `${content}${cacheEntry}\n`
      : `${content}\n${cacheEntry}\n`;
    await writeFile(gitignorePath, newContent, 'utf8');
  } else {
    await writeFile(gitignorePath, `# autotranslate\n${cacheEntry}\n`, 'utf8');
  }

  return { status: 'done', label: `.gitignore: added ${cacheEntry}` };
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
