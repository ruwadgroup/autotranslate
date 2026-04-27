# API Reference

Compact summary of every public export across the workspace. For full prose,
jump to the package READMEs linked at each section.

## `@autotranslate/core`

[Package README](../packages/core/README.md)

### Translator

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

### Hashing

```ts
function hash(input: string, length?: number): string;
function shortHash(input: string): string; // 12 hex chars
```

### Structured trees

```ts
function canonicalKey(tree: StructuredMessage, context?: string): string;
function isStructured(value: unknown): value is StructuredMessage;
function renderTreeToString(
  tree: StructuredMessage,
  locale: Locale,
  params?: Readonly<Record<string, unknown>>,
): string;
```

### Types

```ts
type Locale = string;
type CatalogEntry = string | StructuredMessage;
type Catalog = Record<string, CatalogEntry>;
type Manifest = Record<string, MessageMeta>;

interface MessageMeta {
  readonly context?: string;
  readonly description?: string;
  readonly maxChars?: number;
  readonly occurrences?: ReadonlyArray<MessageOccurrence>;
  readonly overrides?: Readonly<Record<Locale, string>>;
}

interface MessageOccurrence {
  readonly file: string;
  readonly line: number;
  readonly column?: number;
}

type StructuredMessage = ReadonlyArray<TranslationNode>;
type TranslationNode = TextNode | VarNode | PluralNode | BranchNode | TagNode;

interface TextNode {
  readonly type: 'text';
  readonly value: string;
}
interface VarNode {
  readonly type: 'var';
  readonly name: string;
}
interface PluralNode {
  readonly type: 'plural';
  readonly name: string;
  readonly forms: { readonly [K in PluralCategory]?: StructuredMessage };
}
interface BranchNode {
  readonly type: 'branch';
  readonly name: string;
  readonly cases: { readonly [caseName: string]: StructuredMessage };
}
interface TagNode {
  readonly type: 'tag';
  readonly tag: string;
  readonly children: StructuredMessage;
}
```

## `@autotranslate/core/config`

```ts
function defineConfig<const T extends AutotranslateConfigInput>(config: T): T;
function parseConfig(input: unknown): AutotranslateConfig;     // throws ZodError
function safeParseConfig(input: unknown): SafeParseReturnType;

const autotranslateConfigSchema: ZodSchema;
const providerConfigSchema: ZodSchema;

type AutotranslateConfig;          // parsed (defaults applied)
type AutotranslateConfigInput;     // input (defaults optional)
type ProviderConfig =
  | StubProviderConfig
  | AIProviderConfig
  | DeepLProviderConfig
  | GoogleProviderConfig
  | CustomProviderConfig;
```

## `@autotranslate/core/locale`

```ts
function isValidLocale(value: string): boolean;
function standardizeLocale(value: string): Locale;
function getDirection(locale: Locale): 'ltr' | 'rtl';

function matchLocale(options: MatchLocaleOptions): Locale;
function determineLocale(
  preferred: ReadonlyArray<Locale>,
  supported: ReadonlyArray<Locale>,
  defaultLocale: Locale,
): Locale;
function parseAcceptLanguage(
  header: string,
): ReadonlyArray<AcceptLanguageEntry>;

function getLocaleName(locale: Locale, displayLocale?: Locale): string;
function getLocaleProperties(locale: Locale): LocaleProperties;
function getLocaleEmoji(locale: Locale): string | undefined;
function isSameLanguage(a: Locale, b: Locale): boolean;

function getPluralCategory(
  locale: Locale,
  n: number,
  type?: 'cardinal' | 'ordinal',
): PluralCategory;
function isPluralCategory(value: string): value is PluralCategory;
const PLURAL_CATEGORIES: ReadonlyArray<PluralCategory>;

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type LocaleDirection = 'ltr' | 'rtl';

interface MatchLocaleOptions {
  readonly accept?: string;
  readonly cookie?: string;
  readonly path?: string;
  readonly defaultLocale: Locale;
  readonly supported: ReadonlyArray<Locale>;
}

interface LocaleProperties {
  readonly tag: Locale;
  readonly languageCode: string;
  readonly regionCode?: string;
  readonly scriptCode?: string;
  readonly name: string;
  readonly nativeName: string;
  readonly direction: LocaleDirection;
  readonly emoji?: string;
}

interface AcceptLanguageEntry {
  readonly tag: string;
  readonly q: number;
}
```

## `@autotranslate/core/icu`

```ts
function parseICU(input: string): MessageFormatElement[];
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

[Package README](../packages/react/README.md)

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
function useTranslationContext(): TranslationContextValue;

const TranslationContext: Context<TranslationContextValue>;

interface AutotranslateCatalog {} // augmented by generate-types
type CatalogKey = keyof AutotranslateCatalog extends never
  ? string
  : keyof AutotranslateCatalog | (string & {});
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

## `@autotranslate/cli`

[Package README](../packages/cli/README.md) · [CLI commands](cli.md)

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

class ConfigNotFoundError extends Error {}
```

## `@autotranslate/next`

[Package README](../packages/next/README.md) ·
[Next.js guide](frameworks/nextjs.md)

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

const LOCALE_HEADER = 'x-autotranslate-locale';

interface GetTOptions {
  readonly fallback?: Locale;
  readonly load?: CatalogLoader;
  readonly outDir?: string;
  readonly cwd?: string;
}

type CatalogLoader = (locale: Locale) => Promise<Catalog> | Catalog;
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

[Package README](../packages/vite/README.md) · [Vite guide](frameworks/vite.md)

```ts
function autotranslate(options?: AutotranslatePluginOptions): Plugin;

interface AutotranslatePluginOptions {
  readonly cwd?: string;
  readonly outDir?: string;
  readonly locales?: ReadonlyArray<string>;
  readonly source?: string;
  readonly config?: AutotranslateConfig;
}

const VIRTUAL_MODULE_ID = 'virtual:autotranslate';
```

The virtual module exports `catalogs`, `source`, and `locales`.

## `@autotranslate/providers`

[Package README](../packages/providers/README.md) ·
[Providers guide](guides/providers.md)

```ts
function defineProvider<P extends Provider>(provider: P): P;
function pseudoLocalize(input: string): string;
function pseudoLocalizeTree(tree: StructuredMessage): StructuredMessage;
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
class UnsupportedICUError extends Error {}

// @autotranslate/providers/google
function createGoogleProvider(options: GoogleProviderOptions): Provider;
```

## `@autotranslate/eslint-plugin`

[Package README](../packages/eslint-plugin/README.md) ·
[ESLint guide](guides/eslint.md)

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
