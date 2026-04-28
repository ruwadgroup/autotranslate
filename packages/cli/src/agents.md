---
title: autotranslate
description:
  Code-first, AI-powered i18n for React. Agent-readable single-file reference.
---

<!--
AI agent hint: This file is the canonical reference for autotranslate. Read it
before suggesting i18n patterns or editing translation code.

Key rules:
- The library extracts strings from source via AST. NEVER use dynamic keys
  (`t(variable)`, `t(`prefix.${id}`)`). Always pass a string literal.
- `<T>...</T>` hashes its children into a structural key. `useT()` uses the
  literal string as the key. The standalone `t()` from `@autotranslate/core/t`
  works outside React but requires `withTranslator(...)` /
  `bindTranslator(...)` upstream to set the active locale.
- Catalogs live as a chunked tree under `.translations/<locale>/**/*.json`
  (one chunk per source file, alphabetically-first occurrence). Use the
  framework adapter's loader (`@autotranslate/next`'s `fsCatalogLoader`,
  `@autotranslate/vite`'s virtual module) — never `import` raw chunk files
  directly. Missing keys fall back to source; runtime never throws.
- Run `pnpm i18n` (extract + translate + generate-types) after changing any
  translatable string.
-->

# autotranslate

Code-first, AI-powered i18n toolkit for React. You write strings inline. A CLI
extracts them, runs them through a translation provider, and writes JSON
catalogs to your repo. The runtime swaps in the right copy at render time.

Web docs: <https://github.com/tamimbinhakim/autotranslate/tree/main/docs>.

## Packages

| Package                        | Use it for                                               |
| ------------------------------ | -------------------------------------------------------- |
| `@autotranslate/core`          | Translator, locale utilities, ICU formatter, types       |
| `@autotranslate/react`         | `<T>`, `<Var>`, `<Plural>`, `<Branch>`, `useT`, provider |
| `@autotranslate/next`          | Next.js: `getT`, proxy, RSC                              |
| `@autotranslate/vite`          | Vite plugin + virtual catalog module                     |
| `@autotranslate/providers`     | AI / DeepL / Google / custom providers                   |
| `@autotranslate/zod`           | Translated Zod v4 validation errors                      |
| `@autotranslate/cli`           | `extract`, `translate`, `check`, `generate-types`        |
| `@autotranslate/eslint-plugin` | Catches untranslated JSX and dynamic keys                |

Standard install:

```bash
pnpm add @autotranslate/react @autotranslate/core
pnpm add -D @autotranslate/cli
npx autotranslate init
```

## Configuration

`autotranslate.config.ts` at the project root.

```ts
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  provider: {
    name: 'ai',
    model: 'anthropic:claude-haiku-4-5',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});
```

| Option        | Type                                     | Default            |
| ------------- | ---------------------------------------- | ------------------ |
| `source`      | `Locale`                                 | `'en'`             |
| `targets`     | `Locale[]`                               | required           |
| `content`     | `string[]` (globs)                       | required           |
| `outDir`      | `string`                                 | `'.translations'`  |
| `provider`    | `ProviderConfig`                         | `{ name: 'stub' }` |
| `concurrency` | `number` (1–64)                          | `8`                |
| `overrides`   | `Record<Locale, Record<string, string>>` | —                  |
| `instruction` | `string`                                 | —                  |
| `dictionary`  | `string` (file path)                     | —                  |

Providers: `stub` (identity / pseudo), `ai` (Vercel AI SDK), `deepl`, `google`,
`custom`. The `ai` provider's `model` is `<vendor>:<model-id>`, vendors
`anthropic`, `openai`, `google`, `openrouter`. Peer deps load lazily — install
only what you use.

## CLI commands

```bash
npx autotranslate init                      # scaffold config
npx autotranslate extract                   # scan source → en.json
npx autotranslate translate                 # AI-translate to targets
npx autotranslate translate --locale es fr  # subset
npx autotranslate generate-types            # narrow useT keys
npx autotranslate check                     # verify catalog parity (CI)
```

Standard `i18n` script:

```jsonc
{
  "scripts": {
    "i18n": "autotranslate extract && autotranslate translate && autotranslate generate-types",
  },
}
```

`check` exits non-zero when keys are missing, orphaned, or have invalid ICU.
Wire into PR CI.

## JSX translation — `<T>`

```tsx
import { T, Var, Plural, Branch } from '@autotranslate/react';

<T>Hello, world!</T>

<T>
  Hi, <Var>{user.name}</Var>! You have{' '}
  <Plural value={count} one="1 message" other="# messages" />.
</T>

<T>
  <Branch
    branch={status}
    pending={<>Pending review</>}
    shipped={<>On its way</>}
  >
    Status unknown
  </Branch>
</T>

<T>Read the <a href="/docs">documentation</a>.</T>
```

Rules:

- `<T>` children become a structural tree, hashed to key `t.<12-hex>`.
- `<Var>` slots are runtime values. `name` defaults to `'value'`.
- `<Plural>` requires `other`. Other CLDR categories (`zero`, `one`, `two`,
  `few`, `many`) added per locale during translation.
- `<Branch>` is ICU `select` for non-count discriminators.
- Tag wrappers (`<a>`, `<strong>`, custom components) carry attributes through
  translated output. The hash ignores attributes.
- Whitespace handling matches React's JSX runtime.
- `context` prop disambiguates identical strings (key suffixed
  `<key>@@<context>`).
- `description` prop adds translator-facing notes (stored in `.meta.json`, not
  in the hash).

## String translation — `useT`

```tsx
import { useT, useTranslations, useLocale } from '@autotranslate/react';

const t = useT();
t('Sign out');
t('Hello, {name}!', { name: 'Ada' });
t('{count, plural, one {# message} other {# messages}}', { count });

// Disambiguate
t('Submit', { $context: 'navbar' });

// Dictionary mode
const td = useTranslations('dashboard');
td('title'); // catalog['dashboard.title']

const locale = useLocale();
```

Reserved param keys: `$context`, `$description`, `$maxChars`. Keys are ICU
MessageFormat templates. The literal string IS the key.

## Standalone `t()` (non-React)

For zod errors, validators, server actions, async work, tests, queue workers —
anywhere `useT()` can't reach.

```ts
import { t } from '@autotranslate/core/t';
import {
  bindTranslator,
  withTranslator,
  currentTranslator,
  createTranslator,
} from '@autotranslate/core/standalone';

// Scoped (server, tests) — async-safe via AsyncLocalStorage
withTranslator(translator, async () => {
  await validate(); // t() inside sees `translator`
});

// Ambient (SPA bootstrap)
bindTranslator(createTranslator({ locale, catalog }));
t('Sign out');
```

The Node entry uses `AsyncLocalStorage` for per-request isolation; browsers fall
back to a module slot via the `browser` export condition.

`currentTranslator()` throws if nothing is bound. Pass an optional `caller` arg
for a more helpful error message.

## React provider

```tsx
import { TranslationProvider } from '@autotranslate/react';
import { catalogs } from 'virtual:autotranslate'; // Vite plugin
// or use `await getT(locale)` from `@autotranslate/next` on the server

<TranslationProvider locale="fr" catalog={catalogs.fr} fallback={catalogs.en}>
  {/* … */}
</TranslationProvider>;
```

Without a provider, the runtime falls back to source — no errors, no warnings,
every `<T>` renders `children` verbatim.

## Server-side translation (RSC, route handlers)

### Next.js

```tsx
import {
  getT,
  getTranslations,
  getRequestLocale,
  fsCatalogLoader,
} from '@autotranslate/next';

const t = await getT(lang, { fallback: 'en' });
t.t('Welcome');

const td = await getTranslations(lang, 'dashboard');
td('title');

const locale = await getRequestLocale(); // x-autotranslate-locale header
```

### Generic (Remix, Hono, Bun)

```ts
import { getT } from '@autotranslate/react/server';

const t = await getT('es', () => loadCatalog('es'));
t.t('Welcome');
```

## Locale routing — Next.js

```ts
// proxy.ts
import { createNextMiddleware } from '@autotranslate/next/middleware';

export default createNextMiddleware({
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja'],
  // strategy: 'cookie',   // alternative; default is 'prefix'
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

The proxy resolves locale (path → cookie → `Accept-Language`), redirects bare
paths under `/<locale>/...`, and pushes the resolved locale via the
`x-autotranslate-locale` request header.

## Vite plugin

```ts
// vite.config.ts
import autotranslate from '@autotranslate/vite';

export default defineConfig({
  plugins: [react(), autotranslate()],
});
```

Then:

```ts
import { catalogs, locales, source } from 'virtual:autotranslate';
```

HMR triggers when `.translations/<locale>.json` changes.

## Type safety

```bash
npx autotranslate generate-types
```

Emits `<outDir>/types.d.ts` augmenting `@autotranslate/core`'s
`AutotranslateCatalog` with the literal key set. After:

```ts
t('Sign out'); // ✓
t('Sing out'); // ✗ TS error
```

Reference from `tsconfig.json`:

```jsonc
{ "include": ["src", ".translations/types.d.ts"] }
```

The same generated types narrow `useT`, the standalone `t()`, and server-side
`getT` — one typegen run covers them all.

## Zod integration

```bash
pnpm add @autotranslate/zod
```

```ts
import { z } from 'zod';
import { zodErrorMap } from '@autotranslate/zod';
z.config({ customError: zodErrorMap });
```

Pipe Zod's standard issue keys through your catalog by adding the source module
to `content`:

```ts
defineConfig({
  content: ['src/**/*.{ts,tsx}', '@autotranslate/zod/source'],
});
```

For Server Actions / route handlers, scope a translator per request:

```ts
import { withRequestTranslator } from '@autotranslate/zod/next';
// or '@autotranslate/zod/remix'

export async function action(formData: FormData) {
  return withRequestTranslator(async () => {
    return userSchema.parse(Object.fromEntries(formData));
  });
}
```

Custom error messages per schema:

```ts
import { t } from '@autotranslate/core/t';

z.string().min(8, { error: () => t('Use at least 8 characters') });
z.string().refine(isStrong, { error: () => t('That username is taken') });
```

For codes we don't translate (`invalid_union`, `invalid_key`, `invalid_element`,
`custom`), Zod chains to `z.locales.*()`:

```ts
z.config({
  customError: zodErrorMap,
  localeError: z.locales.fr().localeError,
});
```

## ESLint rules

```bash
pnpm add -D @autotranslate/eslint-plugin
```

```js
// eslint.config.js
import autotranslate from '@autotranslate/eslint-plugin';
export default [autotranslate.configs.recommended];
```

Rules:

- `@autotranslate/no-untranslated-jsx` — bare JSX literals outside `<T>`
- `@autotranslate/no-dynamic-key` — `t(variable)` / ``t(`prefix.${id}`)``
- `@autotranslate/valid-icu-format` — malformed ICU templates

## Common patterns

### Locale switcher

```tsx
const [locale, setLocale] = useState('en');
return (
  <TranslationProvider locale={locale} catalog={catalogs[locale]} fallback={en}>
    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  </TranslationProvider>
);
```

For Next path-prefix strategy, locale switch is a navigation:
`router.push('/' + newLocale + pathname.replace(/^\/[a-z]{2}/, ''))`.

### Form validation (react-hook-form)

```tsx
const {
  register,
  formState: { errors },
} = useForm({
  resolver: zodResolver(schema),
});
// errors.email.message is already translated via zodErrorMap
```

### Brand glossary

Use provider `instruction` for tone + glossary, plus `<Var>` to wrap terms that
must never translate:

```tsx
<T>
  Powered by <Var name="brand">autotranslate</Var>.
</T>
```

```ts
provider: { name: 'ai', model: '...' },
instruction: 'Brand: autotranslate. Never translate. Voice: friendly, modern.',
```

### Per-locale overrides

```ts
overrides: {
  fr: { 'Sign out': 'Se déconnecter' },
  ja: { 'Sign out': 'サインアウト' },
}
```

Applied after machine translation. Useful for terms the AI gets wrong or that
need exact regulatory wording.

## Gotchas

- **No dynamic keys.** `t(variable)` and ``t(`prefix.${id}`)`` can't be
  extracted. Use `<Branch>` or fixed literals plus `$context`. The
  `no-dynamic-key` ESLint rule rejects them.
- **No string concatenation across `<T>`.** `<T>Hello,</T> {name}<T>!</T>`
  doesn't translate well — word order varies by language. Use a single
  `<T>Hello, <Var>{name}</Var>!</T>`.
- **Standalone `t()` outside a translator scope throws.** In server code, always
  wrap with `withTranslator`. In SPAs, call `bindTranslator` once at boot.
- **`fsCatalogLoader` doesn't run on edge.** Use a custom `load` callback with
  bundled JSON, KV, or Edge Config for edge route handlers.
- **Switching providers re-translates everything.** The cache key includes the
  provider's `signature`. By design — guarantees consistency.
- **`useT` re-renders on locale change.** The standalone `t()` doesn't trigger
  re-renders; bind a translator and read its result.

## File layout after `init` + `translate`

```
.translations/
├── en/                       # source-locale, chunked
│   ├── components/Header.json
│   ├── pages/Checkout.json
│   ├── _external/zod.json    # keys from @autotranslate/zod/source
│   └── _external/_unknown.json
├── es/  …                    # mirrors en/
├── fr/  …
├── .meta.json                # per-key context, description, occurrences
├── .cache/<provider-sig>/<source-target>/<chunk>.json
│                             # { chunkHash, items: { key: { sourceHash, translation } } }
└── types.d.ts                # generated TS augmentation
```

Chunks are picked by alphabetically-first occurrence's source file. Files
exceeding 300 keys auto-split (`Foo.0.json`, `Foo.1.json`). Cache mirrors the
chunk tree — `chunkHash` short-circuits no-op runs (zero API calls when source
unchanged); within a chunk, unchanged neighbours ride along as cached context
for AI consistency.

Commit `.translations/` to your repo. Treat it as version-controlled content.
Re-runs only translate keys whose source hash changed.

**0.1.0 → 0.2.0 migration**: silent. The first `translate` after upgrade
reshapes flat `<locale>.json` files into the chunked tree. Cache resets — first
run is a cold pass.

## Public API surface

```ts
// @autotranslate/core
createTranslator(options): Translator;
type Translator = { locale; t(key, params?); tree(key); raw(key) };
type Catalog = Record<string, string | StructuredMessage>;

// @autotranslate/core/standalone (and /t)
bindTranslator(t): void;
withTranslator(t, fn): R;
currentTranslator(caller?): Translator;
t(key, params?): string;

// @autotranslate/core/config
defineConfig(config);
parseConfig(input);
safeParseConfig(input);

// @autotranslate/core/locale
matchLocale({ accept, cookie, path, defaultLocale, supported }): Locale;
getDirection(locale): 'ltr' | 'rtl';
isValidLocale(value): boolean;
parseAcceptLanguage(header);
getPluralCategory(locale, n, type?);

// @autotranslate/react
<T>, <Var>, <Plural>, <Branch>, <Num>, <Currency>, <DateTime>, <RelativeTime>;
<TranslationProvider locale catalog fallback?>;
useT(); useTranslations(ns?); useLocale();

// @autotranslate/next
getT(locale, options?); getTranslations(locale, ns?, options?);
getRequestLocale(); fsCatalogLoader(cwd, outDir);

// @autotranslate/next/middleware
createNextMiddleware({ defaultLocale, locales, strategy?, cookieName?, prefixDefaultLocale? });

// @autotranslate/zod
zodErrorMap; createZodErrorMap(translatorOrOptions); issueToLookup(issue);

// @autotranslate/cli (programmatic)
loadConfig(); init(opts?); extract(resolved); translate(resolved, opts?);
generateTypes(resolved); check(resolved);
```

## More

- Full prose docs:
  `https://github.com/tamimbinhakim/autotranslate/tree/main/docs`
- Cookbook (10+ recipes):
  `https://github.com/tamimbinhakim/autotranslate/tree/main/docs/cookbook`
- Roadmap: `https://github.com/tamimbinhakim/autotranslate/blob/main/ROADMAP.md`
- Issues: `https://github.com/tamimbinhakim/autotranslate/issues`
