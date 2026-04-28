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

`defineConfig` is a type-preserving identity helper — it doesn't change the
runtime shape but preserves literal types so downstream typegen can narrow.

## Top-level options

| Option        | Type                                     | Default            | Description                                                |
| ------------- | ---------------------------------------- | ------------------ | ---------------------------------------------------------- |
| `source`      | `Locale`                                 | `'en'`             | The locale your code is written in.                        |
| `targets`     | `Locale[]` (≥ 1)                         | (required)         | Locales to translate into.                                 |
| `content`     | `string[]` (≥ 1)                         | (required)         | Globs of source files to scan.                             |
| `outDir`      | `string`                                 | `'.translations'`  | Where catalogs are written.                                |
| `provider`    | `ProviderConfig`                         | `{ name: 'stub' }` | Translation provider settings.                             |
| `concurrency` | `number` (1–64)                          | `8`                | Max parallel provider requests.                            |
| `overrides`   | `Record<string, Record<string, string>>` | —                  | Per-locale manual overrides applied after MT.              |
| `instruction` | `string`                                 | —                  | Free-form system instruction passed to AI providers.       |
| `glossary`    | `string[]`                               | —                  | Branded terms the AI must never translate / transliterate. |
| `dictionary`  | `string`                                 | —                  | Path to a TS / JS / JSON dictionary file.                  |

### `source` / `targets`

BCP-47 locale tags. Examples: `'en'`, `'en-US'`, `'pt-BR'`, `'zh-Hans-CN'`. The
schema is permissive (`/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/`); strict
validation happens at runtime via `Intl.Locale`.

### `content`

Globs relative to the project root. The CLI uses `fast-glob`; standard `*` /
`**/*` patterns work. Exclude paths with `!`:

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

See [Overrides & glossaries](../cookbook/overrides-and-glossary.md).

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

```tsx
const t = useTranslations('dashboard');
t('title'); // → catalog['dashboard.title']
```

## Provider config

`provider` is a discriminated union — `name` selects the provider, the rest of
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

Custom providers are functions and don't survive JSON serialisation, so
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
