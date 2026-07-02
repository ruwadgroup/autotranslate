# API

The full public TypeScript surface, derived from each package's `exports` map
and source barrel. Signatures are verified against source.

## `@autotranslate/core`

```ts
function createTranslator(options: TranslatorOptions): Translator;

interface TranslatorOptions {
  readonly locale: Locale;
  readonly catalog: Catalog;
  readonly fallback?: Catalog;
  readonly onMissing?: (key: string, locale: Locale) => string;
}

interface Translator {
  readonly locale: Locale;
  t(key: string, params?: Readonly<Record<string, unknown>>): string;
  tree(key: string): StructuredMessage | undefined;
  raw(key: string): CatalogEntry | undefined;
}
```

### Catalog augmentation

```ts
// Augmented by `autotranslate generate-types`.
interface AutotranslateCatalog {}

type CatalogKey = keyof AutotranslateCatalog extends never
  ? string
  : keyof AutotranslateCatalog | (string & {});
```

### Types

```ts
type Locale = string;
type CatalogEntry = string | StructuredMessage;
type Catalog = Record<string, CatalogEntry>;
```

## `@autotranslate/core/standalone` and `/t`

Both subpaths resolve to the same module (`/t` is an alias).

```ts
function bindTranslator(translator: Translator): void;
function withTranslator<R>(translator: Translator, fn: () => R): R;
function currentTranslator(caller?: string): Translator;
function t(key: CatalogKey, params?: Readonly<Record<string, unknown>>): string;

// Also re-exports:
function createTranslator(options: TranslatorOptions): Translator;
type { CatalogKey, Translator, TranslatorOptions };
```

`bindTranslator` binds to the current async chain (Node `AsyncLocalStorage`).
`withTranslator` runs `fn` in a scoped chain. `currentTranslator` throws if no
translator is bound.

See [Standalone `t()`](../guides/standalone-t.md).

## `@autotranslate/core/config`

```ts
function defineConfig<const T extends AutotranslateConfigInput>(config: T): T;
function parseConfig(input: unknown): AutotranslateConfig;
function safeParseConfig(input: unknown): z.ZodSafeParseResult<AutotranslateConfig>;

type AutotranslateConfig;
type AutotranslateConfigInput;
type ProviderConfig;
```

See [Configuration](configuration.md).

## `@autotranslate/core/locale`

```ts
function isValidLocale(value: string): boolean;
function standardizeLocale(value: string): Locale;
function getDirection(locale: Locale): 'ltr' | 'rtl';
function matchLocale(options: MatchLocaleOptions): Locale;
function parseAcceptLanguage(
  header: string,
): ReadonlyArray<{ tag: string; q: number }>;
function getLocaleName(locale: Locale, displayLocale?: Locale): string;
function getLocaleProperties(locale: Locale): LocaleProperties;
function isSameLanguage(a: Locale, b: Locale): boolean;
function getPluralCategory(
  locale: Locale,
  n: number,
  type?: 'cardinal' | 'ordinal',
): PluralCategory;

interface MatchLocaleOptions {
  readonly accept?: string;
  readonly cookie?: string;
  readonly path?: string;
  readonly defaultLocale: Locale;
  readonly supported: ReadonlyArray<Locale>;
}

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
```

## `@autotranslate/core/icu`

```ts
function formatICU(
  input: string,
  locale: Locale,
  values?: Readonly<Record<string, unknown>>,
): string;
function extractVariables(input: string): ReadonlyArray<string>;

class ICUParseError extends Error {
  readonly input: string;
}
```

## `@autotranslate/core/classifier`

Constants used by the extractor and ESLint plugin to classify JSX nodes.

```ts
const CLASSIFIER_VERSION: number;
const TRANSLATION_MARKERS: ReadonlySet<string>; // 'T' | 'Var' | 'Plural' | ...
const NO_TRANSLATE_ATTRIBUTE: string; // 'data-no-translate'
const SKIP_ELEMENTS: ReadonlySet<string>; // 'code' | 'pre' | 'script' | 'style'

function jsxTextHasContent(text: string): boolean;
function isAllowlistedAttribute(name: string): boolean;
```

## `@autotranslate/react`

```tsx
// Components
function T(props: TProps): ReactElement;
function Var(props: VarProps): ReactNode;
function Plural(props: PluralProps): ReactNode;
function Branch(props: BranchProps): ReactNode;
function Num(props: NumProps): ReactNode;
function Currency(props: CurrencyProps): ReactNode;
function DateTime(props: DateTimeProps): ReactNode;
function RelativeTime(props: RelativeTimeProps): ReactNode;

// Provider
function TranslationProvider(props: TranslationProviderProps): ReactElement;

// Hooks
function useT(): (key: CatalogKey, params?: Readonly<Record<string, unknown>>) => string;
function useLocale(): string;
function useTranslationContext(): TranslationContextValue;

// Context
const TranslationContext: React.Context<TranslationContextValue | undefined>;

// Types re-exported from @autotranslate/core
type { AutotranslateCatalog, CatalogKey };
```

### `@autotranslate/react/server`

```ts
async function getT(
  locale: Locale,
  loadCatalog: (locale: Locale) => Promise<Catalog> | Catalog,
  loadFallback?: (locale: Locale) => Promise<Catalog> | Catalog,
): Promise<Translator>;

function createTranslator(options: TranslatorOptions): Translator;
```

## `@autotranslate/next`

```ts
// Translator factory for server components and route handlers.
// Requires exactly one of `options.module` or `options.load`.
async function getT(locale: Locale, options?: GetTOptions): Promise<Translator>;

// Read the locale set by the proxy middleware.
async function getRequestLocale(): Promise<Locale | undefined>;

// Clear the per-process (module, locale) memo. Useful in tests.
function clearCatalogCache(): void;

// Header name written by the proxy and read by getRequestLocale().
const LOCALE_HEADER: string; // 'x-autotranslate-locale'

interface GetTOptions {
  /** Source-locale fallback used when `locale` is missing a key. */
  readonly fallback?: Locale;
  /**
   * Generated catalog module from `<outDir>/index.ts`.
   * Exactly one of `module` or `load` is required.
   */
  readonly module?: CatalogModule;
  /**
   * Custom catalog loader - use for KV, Edge Config, or any non-bundled source.
   * Exactly one of `module` or `load` is required.
   */
  readonly load?: CatalogLoader;
}

// The generated <outDir>/index.ts shape.
interface CatalogModule {
  readonly source: Locale;
  readonly locales: ReadonlyArray<Locale>;
  loadCatalog(locale: Locale): Promise<Catalog>;
}

type CatalogLoader = (locale: Locale) => Promise<Catalog> | Catalog;

interface NextLocaleConfig {
  readonly defaultLocale: Locale;
  readonly locales: ReadonlyArray<Locale>;
}

interface ProxyOptions extends NextLocaleConfig {
  readonly strategy?: 'prefix' | 'cookie';
  readonly cookieName?: string;
  readonly prefixDefaultLocale?: boolean;
}
```

### `@autotranslate/next/plugin`

```ts
function withAutotranslate(
  nextConfig?: NextConfig,
  options?: WithAutotranslateOptions,
): (phase: string, ctx: { defaultConfig?: unknown }) => Promise<NextConfig>;

interface WithAutotranslateOptions {
  /** Start the dev loop in development. Default `true`. */
  devLoop?: boolean;
  /** Build-phase frozen-check options. Config-file `build` settings win when absent. */
  build?: BuildOptions;
}

interface BuildOptions {
  /** Fail the build when the catalog is out of date. Default `true`. */
  frozen?: boolean;
  /** Translate missing strings at build time instead of failing. Default `false`. */
  translateOnBuild?: boolean;
}
```

`withAutotranslate` must be the outermost wrapper in `next.config.ts`. It
returns an async function config so Next.js calls it with the current build
phase.

### `@autotranslate/next/middleware`

```ts
function createNextMiddleware(
  options: ProxyOptions,
): (request: NextRequest) => NextResponse | undefined;

// Re-exports:
const LOCALE_HEADER: string;
type { ProxyOptions };
```

### `@autotranslate/next/auto-loader`

Webpack / Turbopack loader path for `mode: 'auto'`. Not imported directly -
registered by `withAutotranslate` when `mode: 'auto'` is set.

## `@autotranslate/vite`

```ts
// Default export - add to vite.config.ts plugins array.
export default function autotranslate(
  options?: AutotranslatePluginOptions,
): Plugin;

// Named exports:
const VIRTUAL_MODULE_ID: string; // 'virtual:autotranslate'

interface AutotranslatePluginOptions {
  /** Defaults to the Vite project root. */
  readonly cwd?: string;
  /** Defaults to `config.outDir`, falling back to `.translations`. */
  readonly outDir?: string;
  /** Defaults to `[source, ...targets]` from the loaded config. */
  readonly locales?: ReadonlyArray<string>;
  /** Defaults to `config.source`. */
  readonly source?: string;
  /** Pre-parsed config. Skips disk loading when supplied. */
  readonly config?: AutotranslateConfig;
  /** Build-phase frozen-check options. */
  readonly build?: {
    /** Default: `config.build.frozen` (which defaults to `true`). */
    readonly frozen?: boolean;
  };
}
```

### Virtual module `'virtual:autotranslate'`

```ts
// Import in app code:
import { catalogs, source, locales } from 'virtual:autotranslate';

const catalogs: Readonly<Record<Locale, Catalog>>;
const source: Locale;
const locales: ReadonlyArray<Locale>;
```

Add type declarations via `tsconfig.json`:

```jsonc
{ "compilerOptions": { "types": ["@autotranslate/vite/client"] } }
```

## `@autotranslate/cli`

The library export - use this when embedding the pipeline in your own scripts.
The CLI binary (`autotranslate`) wraps these same functions.

```ts
// Config
async function loadConfig(cwd?: string): Promise<ResolvedConfig>;
class ConfigNotFoundError extends Error {}

// Commands
async function init(options?: InitOptions): Promise<InitResult>;
async function extract(resolved: ResolvedConfig): Promise<ExtractResult>;
async function collectExtraction(
  resolved: ResolvedConfig,
): Promise<ExtractResult>;
async function translate(
  resolved: ResolvedConfig,
  options?: TranslateOptions,
): Promise<TranslateResult>;
async function generateTypes(
  resolved: ResolvedConfig,
): Promise<GenerateTypesResult>;
async function check(resolved: ResolvedConfig): Promise<CheckResult>;
async function checkFrozen(resolved: ResolvedConfig): Promise<FrozenReport>;
function formatFrozenReport(report: FrozenReport): string;
async function parity(
  resolved: ResolvedConfig,
  options?: { base?: string; format?: 'text' | 'github' },
): Promise<ParityReport>;
function formatParityReport(report: ParityReport): string;
async function writeCatalogModule(
  resolved: ResolvedConfig,
): Promise<WriteCatalogModuleResult>;

// Dev loop
function createDevLoop(options: DevLoopOptions): DevLoopHandle;

interface DevLoopOptions {
  readonly cwd: string;
  readonly resolved?: ResolvedConfig;
  readonly onEvent?: (event: DevLoopEvent) => void;
}

interface DevLoopHandle {
  close(): Promise<void>;
}

type DevLoopEvent =
  | { type: 'run-start' }
  | { type: 'run-complete'; extract: ExtractResult; translated: boolean }
  | { type: 'error'; error: unknown };

// Key types
interface ResolvedConfig {
  readonly cwd: string;
  readonly config: AutotranslateConfig;
  readonly outDir: string;
}

interface ExtractResult {
  readonly source: Record<string, CatalogEntry>;
  readonly manifest: Manifest;
  readonly fileCount: number;
}

interface TranslateOptions {
  readonly provider?: Provider;
  readonly only?: ReadonlyArray<Locale>;
  readonly concurrency?: number;
  readonly onProgress?: (event: TranslateProgress) => void;
}

interface TranslateResult {
  readonly stats: LocaleStats; // Record<Locale, TranslateStats>
}

interface TranslateStats {
  readonly fetched: number;
  readonly cached: number;
  readonly overridden: number;
}

interface CheckResult {
  readonly problems: ReadonlyArray<CheckProblem>;
  readonly ok: boolean;
}

interface CheckProblem {
  readonly locale: string;
  readonly key: string;
  readonly kind: 'missing' | 'orphan' | 'invalid-icu';
  readonly message?: string;
}

interface FrozenReport {
  readonly ok: boolean;
  readonly missingSource: ReadonlyArray<{
    readonly key: string;
    readonly text: string;
    readonly occurrence: string;
  }>;
  readonly problems: ReadonlyArray<CheckProblem>;
  readonly catalogAbsent: boolean;
}

interface ParityReport {
  readonly added: ReadonlyArray<ParityEntry>;
  readonly changed: ReadonlyArray<ParityChangedEntry>;
  readonly removed: ReadonlyArray<string>;
  readonly problems: ReadonlyArray<CheckProblem>;
  readonly ok: boolean;
}

interface ParityEntry {
  readonly key: string;
  readonly sourceText: string;
  readonly translations: Record<string, string | null>;
}

interface ParityChangedEntry extends ParityEntry {
  readonly previousSourceText: string;
}

interface WriteCatalogModuleResult {
  readonly written: boolean;
}

interface GenerateTypesResult {
  readonly path: string;
  readonly keyCount: number;
}

interface InitOptions {
  readonly cwd?: string;
  readonly framework?: 'next' | 'vite';
  readonly targets?: string[];
  readonly provider?: 'anthropic' | 'openai' | 'google' | 'deepl' | 'stub';
  readonly force?: boolean;
}
```

### `@autotranslate/cli/transform`

Used by the Next.js auto-loader and Vite plugin internally. Available for custom
build tool integrations.

```ts
function transformAutoWrap(
  source: string,
  opts: { filename: string },
): { code: string; changed: boolean };
```

## `@autotranslate/zod`

```ts
import type * as core from 'zod/v4/core';

type ZodErrorMap = core.$ZodErrorMap;
type CreateZodErrorMapInput = Translator | TranslatorOptions;

// Ambient error map - reads the active translator at call time.
const zodErrorMap: ZodErrorMap;

// Explicit error map - bound to a specific translator or TranslatorOptions.
function createZodErrorMap(input: CreateZodErrorMapInput): ZodErrorMap;

// Pure mapping from a Zod raw issue to a catalog lookup.
function issueToLookup(
  issue: core.$ZodRawIssue,
): { key: string; params?: Record<string, unknown> } | undefined;

type { IssueLookup };
```

### `@autotranslate/zod/next`

```ts
async function withRequestTranslator<R>(
  fn: () => R | Promise<R>,
  options?: NextRequestTranslatorOptions,
): Promise<R>;

interface NextRequestTranslatorOptions {
  /** Override the resolved locale. Defaults to `getRequestLocale()`. */
  readonly locale?: Locale;
  /**
   * Generated catalog module from `<outDir>/index.ts`.
   * Exactly one of `module` or `load` is required.
   */
  readonly module?: CatalogModule;
  /**
   * Custom catalog loader.
   * Exactly one of `module` or `load` is required.
   */
  readonly load?: CatalogLoader;
  /** Fallback locale when neither header nor `locale` is set. Default `'en'`. */
  readonly defaultLocale?: Locale;
}

// Local CatalogModule / CatalogLoader types - same shape as @autotranslate/next.
interface CatalogModule {
  readonly source: Locale;
  readonly locales: ReadonlyArray<Locale>;
  loadCatalog(locale: Locale): Promise<Catalog>;
}

type CatalogLoader = (locale: Locale) => Promise<Catalog> | Catalog;
```

### `@autotranslate/zod/remix`

```ts
async function withRequestTranslator<R>(
  request: FetchRequest,
  options: RemixRequestTranslatorOptions,
  fn: () => R | Promise<R>,
): Promise<R>;

interface RemixRequestTranslatorOptions {
  readonly availableLocales: ReadonlyArray<Locale>;
  readonly defaultLocale: Locale;
  readonly loadCatalog: (locale: Locale) => Promise<Catalog> | Catalog;
}

// Structural shape of a fetch Request - compatible with any web-fetch runtime.
interface FetchRequest {
  readonly url: string;
  readonly headers: { get(name: string): string | null };
}
```

## `@autotranslate/eslint-plugin`

```ts
import plugin from '@autotranslate/eslint-plugin';

const rules: Readonly<Record<string, Rule.RuleModule>>;

// Flat config (ESLint 9+):
plugin.configs.recommended; // Linter.Config

// Legacy config:
plugin.configs['recommended-legacy']; // Linter.Config
```

Rules:

| Rule                                 | Default | Description                                 |
| ------------------------------------ | ------- | ------------------------------------------- |
| `@autotranslate/no-untranslated-jsx` | `warn`  | JSX text nodes not inside `<T>`             |
| `@autotranslate/no-dynamic-key`      | `error` | `t(variable)` calls - keys must be literals |
| `@autotranslate/valid-icu-format`    | `error` | Malformed ICU strings passed to `t()`       |

Flat config usage:

```ts
// eslint.config.ts
import autotranslate from '@autotranslate/eslint-plugin';

export default [autotranslate.configs.recommended];
```

## `@autotranslate/typescript-plugin`

A TypeScript Language Service plugin - not imported; configured in
`tsconfig.json`.

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@autotranslate/typescript-plugin",
        "outDir": ".translations", // default
        "source": "en", // source locale, default "en"
        "severity": "warning", // "error" | "warning" | "suggestion"
        "locale": "fr", // locale to show inlay hints for; defaults to first non-source locale
      },
    ],
  },
}
```

Features:

- **Missing-key diagnostic** - flags `t('literal')` calls where the string is
  not in the source catalog. Diagnostic code `99001`.
- **Translation inlay hints** - shows the translated value inline after each
  `t('...')` call in the editor. Truncated at 40 characters.

Tracks `useT` and `t` imported from `@autotranslate/react` or
`@autotranslate/core/standalone` (and `/t`). Also follows `const t = useT()`
aliasing.

## `@autotranslate/providers`

```ts
function defineProvider<P extends Provider>(provider: P): P;
function createStubProvider(options?: StubProviderOptions): Provider;

interface Provider {
  readonly name: string;
  readonly signature: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

interface TranslationItem {
  readonly key: string;
  readonly source: CatalogEntry;
  readonly context?: string;
  readonly description?: string;
  readonly maxChars?: number;
}

interface TranslationRequest {
  readonly source: Locale;
  readonly target: Locale;
  readonly items: ReadonlyArray<TranslationItem>;
  readonly instruction?: string;
  readonly signal?: AbortSignal;
}

interface TranslationResult {
  readonly translations: Readonly<Record<string, CatalogEntry>>;
}
```

### Provider subpaths

```ts
// @autotranslate/providers/ai
function createAIProvider(options: AIProviderOptions): Provider;

// @autotranslate/providers/deepl
function createDeepLProvider(options: DeepLProviderOptions): Provider;

// @autotranslate/providers/google
function createGoogleProvider(options: GoogleProviderOptions): Provider;
```
