# @autotranslate/providers

Pluggable translation providers for
[autotranslate](https://github.com/tamimbinhakim/autotranslate). Each provider
implements a single async `translate(request)` method; the CLI handles batching,
concurrency, and caching on top.

```bash
pnpm add @autotranslate/providers
```

## Quick features

- **Vercel AI SDK.** Anthropic, OpenAI, Google, OpenRouter — peer deps load
  lazily so you only install the vendor you actually use.
- **Classic MT.** DeepL and Google Cloud Translation v2 for short copy. ICU
  placeholders are shielded behind opaque sentinels so the translator never sees
  variable names.
- **Pseudo-localization.** `createStubProvider({ pseudo: true })` accents
  letters and wraps text in expansion brackets — surfaces untranslated UI and
  layout overflow in dev.
- **Custom providers.** `defineProvider({ name, signature, translate })`. Hook
  up any HTTP API, local LLM, or in-house service.

## Subpath entries

| Entry                             | Status  | Provider                                              |
| --------------------------------- | ------- | ----------------------------------------------------- |
| `@autotranslate/providers`        | shipped | Types, `defineProvider`, pseudo helpers, stub         |
| `@autotranslate/providers/stub`   | shipped | Identity / pseudo-localization                        |
| `@autotranslate/providers/ai`     | shipped | Vercel AI SDK (Anthropic, OpenAI, Google, OpenRouter) |
| `@autotranslate/providers/deepl`  | shipped | DeepL Pro / Free                                      |
| `@autotranslate/providers/google` | shipped | Google Cloud Translation v2                           |

## Quick start

```ts
import { createAIProvider } from '@autotranslate/providers/ai';

const provider = createAIProvider({
  model: 'anthropic:claude-haiku-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
  instruction: 'Match a casual, modern product voice.',
});

const result = await provider.translate({
  source: 'en',
  target: 'es',
  items: [
    { key: 'Sign out', source: 'Sign out' },
    { key: 'greeting', source: 'Hello, {name}!' },
  ],
});
```

```ts
import { createStubProvider } from '@autotranslate/providers/stub';

// CI, tests, dev mode
const stub = createStubProvider();

// Pseudo-localization to surface untranslated UI
const pseudo = createStubProvider({ pseudo: true });
```

```ts
import { defineProvider } from '@autotranslate/providers';

export const myProvider = defineProvider({
  name: 'custom',
  signature: 'custom:v1',
  async translate({ items }) {
    // Call your service here.
    return {
      translations: {
        /* key → string | tree */
      },
    };
  },
});
```

## How the AI provider works

1. **Linearize** every source entry to ICU MessageFormat (a tree like
   `<T>Hello, <Var name="name"/>!</T>` becomes `Hello, {name}!`).
2. **Batch** items up to `maxBatchSize` (default 50) per `generateObject` call.
3. **Translate** with a Zod-validated schema so the model returns
   `{ translations: [{ key, icu }, …] }` and bad shapes fail fast.
4. **Reconstruct** trees by parsing the returned ICU back into the same
   `StructuredMessage` shape.

ICU is a far better wire format than custom JSON because the model already knows
it — placeholders, plurals, and tag wrappers survive round-trips without
prompt-engineering gymnastics.

### Vendor selection

The `model` string is `<vendor>:<model-id>`:

| Vendor       | Example                                 | Peer dep                                 |
| ------------ | --------------------------------------- | ---------------------------------------- |
| `anthropic`  | `anthropic:claude-haiku-4-5`            | `@ai-sdk/anthropic`                      |
| `openai`     | `openai:gpt-4o-mini`                    | `@ai-sdk/openai`                         |
| `google`     | `google:gemini-2.5-flash`               | `@ai-sdk/google`                         |
| `openrouter` | `openrouter:anthropic/claude-haiku-4-5` | `@ai-sdk/openai` (OpenAI-compatible API) |

For non-standard backends, pass `resolveModel` to bypass the built-in factory.

## How the DeepL / Google providers work

DeepL and Google handle plain-string entries only. ICU placeholders (`{name}`,
`{age, number}`) are wrapped in opaque `[[ATPH:N]]` sentinels before the call
and restored after, so the translator only sees natural- language text.

Plural / select / pound / tag entries throw `UnsupportedICUError` — route those
through the `ai` provider.

## API

### `@autotranslate/providers`

- `createStubProvider(opts?)` → `Provider`
- `defineProvider(impl)` — type-preserving identity helper
- `pseudoLocalize(s)`, `pseudoLocalizeTree(tree)`
- Types: `Provider`, `TranslationItem`, `TranslationRequest`,
  `TranslationResult`, `StubProviderOptions`

### `@autotranslate/providers/ai`

- `createAIProvider(opts)` → `Provider`
- Types: `AIProviderOptions`

### `@autotranslate/providers/deepl`

- `createDeepLProvider(opts)` → `Provider`
- Types: `DeepLProviderOptions`
- `UnsupportedICUError`

### `@autotranslate/providers/google`

- `createGoogleProvider(opts)` → `Provider`
- Types: `GoogleProviderOptions`
- `UnsupportedICUError`
