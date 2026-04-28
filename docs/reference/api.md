# API

The public TypeScript surface, scoped to what end-users actually call. For the
full export list of any package, see its package README.

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

## `@autotranslate/core/standalone` (and `/t`)

```ts
function bindTranslator(translator: Translator): void;
function withTranslator<R>(translator: Translator, fn: () => R): R;
function currentTranslator(caller?: string): Translator;
function t(key: CatalogKey, params?: Readonly<Record<string, unknown>>): string;
```

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

## `@autotranslate/react`

```tsx
function T(props: TProps): ReactElement;
function Var(props: VarProps): ReactNode;
function Plural(props: PluralProps): ReactNode;
function Branch(props: BranchProps): ReactNode;
function Num(props: NumProps): ReactNode;
function Currency(props: CurrencyProps): ReactNode;
function DateTime(props: DateTimeProps): ReactNode;
function RelativeTime(props: RelativeTimeProps): ReactNode;

function TranslationProvider(props: TranslationProviderProps): ReactElement;
function useT(): (
  key: CatalogKey,
  params?: Readonly<Record<string, unknown>>,
) => string;
function useTranslations(
  namespace?: string,
): (key: CatalogKey, params?: Readonly<Record<string, unknown>>) => string;
function useLocale(): string;
```

### `@autotranslate/react/server`

```ts
function getT(
  locale: Locale,
  loadCatalog: (locale: Locale) => Promise<Catalog> | Catalog,
  loadFallback?: (locale: Locale) => Promise<Catalog> | Catalog,
): Promise<Translator>;
```

## `@autotranslate/cli`

```ts
async function loadConfig(cwd?: string): Promise<ResolvedConfig>;
async function init(options?: InitOptions): Promise<InitResult>;
async function extract(resolved: ResolvedConfig): Promise<ExtractResult>;
async function translate(
  resolved: ResolvedConfig,
  options?: TranslateOptions,
): Promise<TranslateResult>;
async function generateTypes(
  resolved: ResolvedConfig,
): Promise<GenerateTypesResult>;
async function check(resolved: ResolvedConfig): Promise<CheckResult>;
```

## `@autotranslate/next`

```ts
async function getT(locale: Locale, options?: GetTOptions): Promise<Translator>;
async function getTranslations(
  locale: Locale,
  namespace?: string,
  options?: GetTOptions,
): Promise<(key: string, params?: Readonly<Record<string, unknown>>) => string>;
async function getRequestLocale(): Promise<Locale | undefined>;
function fsCatalogLoader(cwd: string, outDir: string): CatalogLoader;
function clearCatalogCache(): void;

interface GetTOptions {
  readonly fallback?: Locale;
  readonly load?: CatalogLoader;
  readonly outDir?: string;
  readonly cwd?: string;
}
```

### `@autotranslate/next/middleware`

```ts
function createNextMiddleware(
  options: ProxyOptions,
): (request: NextRequest) => NextResponse | undefined;

interface ProxyOptions {
  readonly defaultLocale: Locale;
  readonly locales: ReadonlyArray<Locale>;
  readonly strategy?: 'prefix' | 'cookie';
  readonly cookieName?: string;
  readonly prefixDefaultLocale?: boolean;
}
```

### `@autotranslate/next/plugin`

```ts
function withAutotranslate<T>(nextConfig: T): T;
```

## `@autotranslate/vite`

```ts
function autotranslate(options?: AutotranslatePluginOptions): Plugin;

interface AutotranslatePluginOptions {
  readonly cwd?: string;
  readonly outDir?: string;
  readonly locales?: ReadonlyArray<string>;
  readonly source?: string;
  readonly config?: AutotranslateConfig;
}
```

The virtual module `'virtual:autotranslate'` exports `catalogs`, `source`, and
`locales`.

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

### Subpaths

```ts
// @autotranslate/providers/ai
function createAIProvider(options: AIProviderOptions): Provider;

// @autotranslate/providers/deepl
function createDeepLProvider(options: DeepLProviderOptions): Provider;

// @autotranslate/providers/google
function createGoogleProvider(options: GoogleProviderOptions): Provider;
```

## `@autotranslate/zod`

```ts
type ZodErrorMap = (
  issue: $ZodRawIssue,
) => { message: string } | string | undefined | null;

const zodErrorMap: ZodErrorMap;
function createZodErrorMap(input: Translator | TranslatorOptions): ZodErrorMap;

function issueToLookup(
  issue: $ZodRawIssue,
): { key: string; params?: Record<string, unknown> } | undefined;
```

### Adapters

```ts
// @autotranslate/zod/next
async function withRequestTranslator<R>(
  fn: () => R | Promise<R>,
  options?: NextRequestTranslatorOptions,
): Promise<R>;

// @autotranslate/zod/remix
async function withRequestTranslator<R>(
  request: FetchRequest,
  options: RemixRequestTranslatorOptions,
  fn: () => R | Promise<R>,
): Promise<R>;
```

## `@autotranslate/eslint-plugin`

```ts
const rules: Readonly<Record<string, Rule.RuleModule>>;
const configs: {
  recommended: Linter.Config;
  'recommended-legacy': Linter.Config;
};
```

Rules:

- `@autotranslate/no-untranslated-jsx`
- `@autotranslate/no-dynamic-key`
- `@autotranslate/valid-icu-format`
