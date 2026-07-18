# Configuration

`autotranslate.config.ts` lives at your project root. The CLI, the Vite plugin,
and the Next.js plugin all read it. The schema is validated by Zod — typos and
bad shapes fail at config-load time.

## `defineConfig`

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

`defineConfig` is a type-preserving identity helper — it does not change the
runtime shape but preserves literal types so downstream typegen can narrow.

## Top-level options

| Option        | Type                                     | Default            | Description                                                |
| ------------- | ---------------------------------------- | ------------------ | ---------------------------------------------------------- |
| `source`      | `Locale`                                 | `'en'`             | The locale your code is written in.                        |
| `targets`     | `Locale[]` (≥ 1)                         | (required)         | Locales to translate into.                                 |
| `content`     | `string[]` (≥ 1)                         | (required)         | Globs of source files to scan.                             |
| `outDir`      | `string`                                 | `'.translations'`  | Where catalogs are written.                                |
| `provider`    | `ProviderConfig`                         | `{ name: 'stub' }` | Translation provider settings.                             |
| `concurrency` | `number` (1-64)                          | `8`                | Max parallel provider requests.                            |
| `overrides`   | `Record<string, Record<string, string>>` | -                  | Per-locale manual overrides applied after MT.              |
| `instruction` | `string`                                 | -                  | Free-form system instruction passed to AI providers.       |
| `glossary`    | `string[]`                               | -                  | Branded terms the AI must never translate / transliterate. |
| `mode`        | `'explicit' \| 'auto'`                   | `'explicit'`       | Whether the compiler wraps JSX text automatically.         |
| `build`       | `{ frozen, translateOnBuild }`           | see below          | Build-phase frozen-check behavior.                         |

### `source` / `targets`

BCP-47 locale tags. Examples: `'en'`, `'en-US'`, `'pt-BR'`, `'zh-Hans-CN'`. The
schema is permissive (`/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/`); strict
validation happens at runtime via `Intl.Locale`.

**Adding a locale:** add the tag to `targets`, then restart your dev server or
run `npx autotranslate translate --locale de` once. The dev loop reads the
config at startup, so a restart is required to pick up a new target; only the
new locale is translated - the cache for existing locales stays intact.

**Removing a locale:** remove the tag from `targets` and delete
`.translations/<locale>/`. The cache entries remain (harmless) until the next
run rewrites them. Run `npx autotranslate check` afterward to confirm no orphan
references remain.

### `content`

Globs relative to the project root. The CLI uses `fast-glob`; standard `*` /
`**/*` patterns work. Exclude paths with `!`:

```ts
content: ['src/**/*.{ts,tsx}', '!src/**/*.test.tsx'],
```

### `outDir`

Resolves relative to the project root. After `extract` and `translate`, the
directory contains:

```
<outDir>/
├── <source>/                                  # source locale, hash-bucketed
│   ├── 0.json ... f.json
├── <target>/                                  # one chunk tree per target locale
│   ├── 0.json ... f.json
├── index.ts                                   # generated catalog module
├── .meta.json                                 # per-key context, descriptions, occurrences
├── .cache/<provider-sig>/<source-target>/<chunk>.json
└── types.d.ts                                 # generated TS augmentation
```

### `mode`

Controls whether JSX text is automatically wrapped at compile time.

```ts
mode: 'auto',
```

| Value      | Behavior                                                       |
| ---------- | -------------------------------------------------------------- |
| `explicit` | Default. You write `<T>` markers by hand.                      |
| `auto`     | The compiler wraps qualifying JSX text nodes in `<T>` for you. |

In `auto` mode:

- `<p>Hello {user.name}</p>` compiles to
  `<p><T>Hello <Var>{user.name}</Var></T></p>`
- **Host-element copy attributes are translated too** — in a `"use client"`
  file, `<input placeholder="Search cases" />` compiles to
  `<input placeholder={t("Search cases")} />` and a `const t = useT()` binding
  is injected into (or reused from) the enclosing component/hook. Non-copy
  attributes (`className`, `href`, `type`, `data-*`, …) are left alone. Because
  `useT()` is a client hook, attribute translation runs **only in client
  modules**; server-component attributes keep their literal and are surfaced by
  the lint rule. Custom-component copy props (`<Field placeholder=…>`) are left
  to the component — extraction still records the string.
- Opt out with `data-no-translate` on any element (text and attributes)
- `code`, `pre`, `script`, and `style` elements are always skipped
- The extractor pipes source files through the same transform before running so
  extracted keys match compiled output key-for-key — the injected `t("…")` calls
  extract identically to hand-written `useT()`
- `withAutotranslate` registers `@autotranslate/next/auto-loader` for webpack
  and turbopack; `@autotranslate/vite` applies the transform hook

The shared classifier (`@autotranslate/core/classifier`) ensures the ESLint
rule, the compiler transform, and the extractor all agree on what counts as
translatable text.

### `build`

Controls the frozen-catalog check that runs during production builds.

```ts
build: {
  frozen: true,            // default - fail build when catalog is incomplete
  translateOnBuild: false, // default - do not call the model at build time
},
```

| Option             | Type      | Default | Description                                               |
| ------------------ | --------- | ------- | --------------------------------------------------------- |
| `frozen`           | `boolean` | `true`  | Run `checkFrozen` at build time; fail if strings missing. |
| `translateOnBuild` | `boolean` | `false` | Run `translate` on failure before re-checking.            |

When `frozen: true` (the default), the build re-extracts your source in memory,
compares it against the committed catalog, and fails with a precise error if
anything is uncommitted. The model is never called — CI needs no API key.

Set `translateOnBuild: true` if you want the build to translate instead of fail
(tokens are spent at build time).

These options can also be overridden per-plugin in `withAutotranslate` or the
Vite plugin; the config file values are the source of truth when not supplied to
the plugin.

### `overrides`

Manual per-locale strings applied **after** machine translation. Useful for
brand terms and idioms the model gets wrong.

```ts
overrides: {
  fr: {
    'Sign out': 'Se déconnecter',
  },
  ja: {
    'Welcome': 'ようこそ',
  },
},
```

`overrides` is per-locale, not per-tenant. For multi-tenant setups, use one
config per tenant with a separate `outDir` per config - nothing is shared
between configs. Each tenant's catalog is fully independent; `overrides` within
a config applies only to that config's locales.

See [Overrides & glossaries](../cookbook/overrides-and-glossary.md).

### `instruction`

Free-form prompt passed to AI providers as a system hint. Use it for tone,
audience, brand voice.

```ts
instruction: 'Translate UI copy for a developer-tools product. Match a friendly, modern voice. Preserve product names verbatim.',
```

## Provider config

`provider` is a discriminated union — `name` selects the provider; the rest of
the shape varies.

### `stub`

Identity / pseudo-localisation. No network, no credentials. Default.

```ts
provider: { name: 'stub' }
provider: { name: 'stub', pseudo: true }   // surfaces untranslated UI
```

### `ai`

Vercel AI SDK-backed.

```ts
provider: {
  name: 'ai',
  model: 'anthropic:claude-haiku-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
}
```

`model` is `<vendor>:<model-id>`. Supported vendors: `anthropic`, `openai`,
`google`, `openrouter`. See [Providers guide](../guides/providers.md).

### `deepl`

```ts
provider: {
  name: 'deepl',
  apiKey: process.env.DEEPL_API_KEY,
  endpoint: 'https://api-free.deepl.com/v2/translate',
  formality: 'prefer_more',
}
```

Plain-string entries only.

### `google`

```ts
provider: {
  name: 'google',
  apiKey: process.env.GOOGLE_API_KEY,
}
```

Same scope as DeepL — plain-string entries only.

### `custom`

Custom providers are functions and do not survive JSON serialisation, so
declaring `name: 'custom'` tells the CLI to expect the provider to be supplied
programmatically:

```ts
import { translate } from '@autotranslate/cli';

await translate(resolved, { provider: myCustomProvider });
```

See [Custom provider cookbook](../cookbook/custom-provider.md).

## Loading the config in code

```ts
import { loadConfig } from '@autotranslate/cli';

const resolved = await loadConfig();
// resolved.config — parsed config
// resolved.cwd    — project root
// resolved.outDir — absolute path to outDir
```

For inline validation:

```ts
import { parseConfig, safeParseConfig } from '@autotranslate/core/config';

const config = parseConfig(input); // throws ZodError on bad input
const result = safeParseConfig(input); // returns { success, data | error }
```
