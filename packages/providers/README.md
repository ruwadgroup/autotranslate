# @autotranslate/providers

Pluggable translation providers for
[autotranslate](https://github.com/tamimbinhakim/autotranslate). Each provider
implements a single async `translate(request)` method; the CLI handles batching,
concurrency, and caching on top.

```bash
pnpm add @autotranslate/providers
```

## Subpath entries

| Entry                             | Status  | Provider                                                        |
| --------------------------------- | ------- | --------------------------------------------------------------- |
| `@autotranslate/providers`        | shipped | Types, `defineProvider`, `pseudoLocalize`, `createStubProvider` |
| `@autotranslate/providers/stub`   | shipped | Identity / pseudo-localization                                  |
| `@autotranslate/providers/ai`     | shipped | Vercel AI SDK (OpenAI, Anthropic, Google, OpenRouter)           |
| `@autotranslate/providers/deepl`  | v0.5    | DeepL (placeholder; throws today)                               |
| `@autotranslate/providers/google` | v0.5    | Google Cloud Translation (placeholder; throws today)            |

## Usage

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

// Custom provider — wire any HTTP API or local LLM.
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
it — placeholders, plurals, and tag wrappers survive round-trips reliably
without prompt-engineering gymnastics.

### Vendor selection

The `model` string is `<vendor>:<model-id>`:

| Vendor       | Example                                 | Peer dep                                          |
| ------------ | --------------------------------------- | ------------------------------------------------- |
| `anthropic`  | `anthropic:claude-haiku-4-5`            | `@ai-sdk/anthropic`                               |
| `openai`     | `openai:gpt-4o-mini`                    | `@ai-sdk/openai`                                  |
| `google`     | `google:gemini-2.5-flash`               | `@ai-sdk/google`                                  |
| `openrouter` | `openrouter:anthropic/claude-haiku-4-5` | `@ai-sdk/openai` (used for OpenAI-compatible API) |

Peer deps are loaded lazily — install only the vendor(s) you use. For
non-standard backends, pass `resolveModel` to bypass the built-in factory.

## Public API

### `@autotranslate/providers`

- `createStubProvider(opts?)` → `Provider`
- `defineProvider(impl)` — type-preserving identity helper
- `pseudoLocalize(s)`, `pseudoLocalizeTree(tree)`
- Types: `Provider`, `TranslationItem`, `TranslationRequest`,
  `TranslationResult`, `StubProviderOptions`

### `@autotranslate/providers/ai`

- `createAIProvider(opts)` → `Provider`
- Types: `AIProviderOptions`
