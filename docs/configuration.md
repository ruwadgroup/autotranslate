# Configuration

`autotranslate.config.ts` lives at your project root. It's loaded by the CLI,
the Vite plugin, and the Next.js plugin. The schema is validated by Zod, so
typos and bad shapes fail loudly at config-load time.

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

`defineConfig` is a type-preserving identity helper — it doesn't change the
runtime shape, but it preserves literal types so downstream typegen can narrow
at the call site.

## Top-level options

| Option        | Type                                     | Default            | Description                                           |
| ------------- | ---------------------------------------- | ------------------ | ----------------------------------------------------- |
| `source`      | `Locale`                                 | `'en'`             | The locale your code is written in.                   |
| `targets`     | `Locale[]` (≥ 1)                         | (required)         | Locales to translate into.                            |
| `content`     | `string[]` (≥ 1)                         | (required)         | Globs of source files to scan.                        |
| `outDir`      | `string`                                 | `'.translations'`  | Where catalogs are written.                           |
| `provider`    | `ProviderConfig`                         | `{ name: 'stub' }` | Translation provider settings.                        |
| `concurrency` | `number` (1–64)                          | `8`                | Max parallel provider requests.                       |
| `overrides`   | `Record<string, Record<string, string>>` | —                  | Per-locale manual overrides applied after MT.         |
| `instruction` | `string`                                 | —                  | Free-form system instruction passed to AI providers.  |
| `dictionary`  | `string`                                 | —                  | Path to a TS / JS / JSON dictionary file (see below). |

### `source` / `targets`

BCP-47 locale tags. Examples: `'en'`, `'en-US'`, `'pt-BR'`, `'zh-Hans-CN'`. The
schema is permissive (`/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/`); strict
validation happens at runtime via `Intl.Locale`.

### `content`

Globs relative to the project root. The CLI uses `fast-glob`; standard `*` /
`**/*` patterns work. Exclude paths via `!`-prefixed patterns:

```ts
content: ['src/**/*.{ts,tsx}', '!src/**/*.test.tsx'],
```

### `outDir`

Resolves relative to the project root. The CLI writes:

```
<outDir>/<source>.json   # canonical source catalog
<outDir>/<target>.json   # one per target locale
<outDir>/.meta.json      # per-key context, description, occurrences
<outDir>/.cache/         # per-(source, target, provider) cache
```

### `overrides`

Manual per-locale strings applied **after** machine translation. Useful for
brand terms, idioms the model gets wrong, or locale-specific copy.

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

### `instruction`

Free-form prompt passed to AI providers as a system hint. Use it for tone,
audience, brand voice.

```ts
instruction: 'Translate UI copy for a developer-tools product. Match a friendly, modern voice. Preserve product names verbatim.',
```

### `dictionary`

Path to a TS / MTS / JS / MJS / JSON file with a default-exported plain object
whose leaves are strings. The CLI flattens it into `dot.path` keys and merges
them into the source catalog.

```ts
// src/dictionary.ts
export default {
  dashboard: {
    title: 'Dashboard',
    greeting: 'Welcome, {name}!',
  },
};
```

```ts
// autotranslate.config.ts
export default defineConfig({
  // …
  dictionary: 'src/dictionary.ts',
});
```

```ts
// component.tsx
const t = useTranslations('dashboard');
t('title'); // → catalog['dashboard.title']
```

## Provider config

`provider` is a discriminated union — `name` selects the provider, the rest of
the shape varies.

### `stub`

Identity / pseudo-localization. No network, no credentials. Useful for CI and as
the default before you wire up AI.

```ts
provider: { name: 'stub' }
provider: { name: 'stub', pseudo: true }   // surfaces untranslated UI
```

### `ai`

Vercel AI SDK-backed. `model` is `<vendor>:<model-id>`.

```ts
provider: {
  name: 'ai',
  model: 'anthropic:claude-haiku-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
}
```

Supported vendors: `anthropic`, `openai`, `google`, `openrouter`. Peer deps
(`@ai-sdk/anthropic`, etc.) load lazily — install only what you use. See the
[Providers guide](guides/providers.md) for details.

### `deepl`

```ts
provider: {
  name: 'deepl',
  apiKey: process.env.DEEPL_API_KEY,
  endpoint: 'https://api-free.deepl.com/v2/translate', // free tier
  formality: 'prefer_more',
}
```

DeepL handles plain-string entries only. Plural / select / tag entries throw —
route those through the `ai` provider.

### `google`

```ts
provider: {
  name: 'google',
  apiKey: process.env.GOOGLE_API_KEY,
}
```

Same scope as DeepL — plain-string entries only.

### `custom`

Custom providers are functions and don't survive JSON serialization, so
declaring `name: 'custom'` in the config tells the CLI to expect the provider to
be supplied programmatically:

```ts
import { translate } from '@autotranslate/cli';

await translate(resolved, { provider: myCustomProvider });
```

See [`defineProvider`](guides/providers.md#custom-providers) for authoring.

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
