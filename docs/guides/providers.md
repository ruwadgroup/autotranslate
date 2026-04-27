# Providers

Providers turn source-locale entries into translations. Every provider
implements one method:

```ts
interface Provider {
  readonly name: string;
  readonly signature: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
```

The CLI handles batching, concurrency, caching, and override application on top.

## Built-in providers

| Provider                          | Status  | When to use                                                             |
| --------------------------------- | ------- | ----------------------------------------------------------------------- |
| `@autotranslate/providers/stub`   | shipped | CI, tests, dev mode without credentials.                                |
| `@autotranslate/providers/ai`     | shipped | Production. Anthropic / OpenAI / Google / OpenRouter via Vercel AI SDK. |
| `@autotranslate/providers/deepl`  | shipped | Plain-string copy. Excellent quality on supported pairs.                |
| `@autotranslate/providers/google` | shipped | Plain-string copy. Cheap and fast.                                      |
| `defineProvider`                  | shipped | Anything else — local LLMs, internal services, glossary lookups.        |

## `stub`

Identity provider. Returns the source unchanged, optionally pseudo-localized.

```ts
import { createStubProvider } from '@autotranslate/providers/stub';

const stub = createStubProvider();
const pseudo = createStubProvider({ pseudo: true });
```

`pseudo: true` accents letters and wraps text in `⟦ … ⟧` brackets:

```
'Sign out' → '⟦ Šíǵñ óúţ ⟧'
'Welcome, {name}!' → '⟦ Ŵéĺçóɱé, {name}! ⟧'  (placeholders preserved)
```

Useful for surfacing untranslated UI and layout overflow during dev. ICU
placeholders, plurals, select arms, and tag wrappers all pass through verbatim.

## `ai`

Vercel AI SDK-backed. Linearizes every source entry to ICU MessageFormat,
batches up to `maxBatchSize` (default 50) per `generateObject` call, and parses
the returned ICU back into the structured tree.

```ts
import { createAIProvider } from '@autotranslate/providers/ai';

const provider = createAIProvider({
  model: 'anthropic:claude-haiku-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
  instruction: 'Match a casual, modern product voice.',
});
```

| Option         | Type                                   | Notes                                        |
| -------------- | -------------------------------------- | -------------------------------------------- |
| `model`        | `string`                               | `<vendor>:<model-id>` (required).            |
| `apiKey`       | `string`                               | Falls back to vendor-default env vars.       |
| `instruction`  | `string`                               | System prompt — tone, audience, brand voice. |
| `maxBatchSize` | `number` (default `50`)                | Items per `generateObject` call.             |
| `resolveModel` | `(model, apiKey?) => Promise<unknown>` | Custom resolver (e.g. AI Gateway).           |

### Vendors

| Vendor       | Example                                 | Peer dep                                 |
| ------------ | --------------------------------------- | ---------------------------------------- |
| `anthropic`  | `anthropic:claude-haiku-4-5`            | `@ai-sdk/anthropic`                      |
| `openai`     | `openai:gpt-4o-mini`                    | `@ai-sdk/openai`                         |
| `google`     | `google:gemini-2.5-flash`               | `@ai-sdk/google`                         |
| `openrouter` | `openrouter:anthropic/claude-haiku-4-5` | `@ai-sdk/openai` (OpenAI-compatible API) |

Peer deps load lazily — install only the vendor you actually use.

ICU is the wire format because every modern frontier model knows it.
Placeholders, plurals, and tag wrappers survive round-trips reliably without
prompt-engineering gymnastics.

## `deepl`

Plain-string entries only. ICU placeholders are wrapped in opaque `[[ATPH:N]]`
sentinels before the call and restored after.

```ts
import { createDeepLProvider } from '@autotranslate/providers/deepl';

const provider = createDeepLProvider({
  apiKey: process.env.DEEPL_API_KEY,
  endpoint: 'https://api-free.deepl.com/v2/translate', // free tier
  formality: 'prefer_more',
  context: 'developer-tool UI',
});
```

| Option      | Type                                                               |
| ----------- | ------------------------------------------------------------------ |
| `apiKey`    | `string` (required).                                               |
| `endpoint`  | `string` — defaults to `https://api.deepl.com/v2/translate`.       |
| `formality` | `'default' \| 'more' \| 'less' \| 'prefer_more' \| 'prefer_less'`. |
| `context`   | `string` — passed through to DeepL.                                |
| `localeMap` | `Record<string, string>` — override BCP-47 → DeepL mapping.        |
| `fetch`     | `FetchLike` — inject a custom HTTP layer.                          |

Plural / select / pound (`#`) / tag entries throw `UnsupportedICUError` — route
those through the `ai` provider.

## `google`

Same scope as DeepL. Google Cloud Translation v2.

```ts
import { createGoogleProvider } from '@autotranslate/providers/google';

const provider = createGoogleProvider({
  apiKey: process.env.GOOGLE_API_KEY,
});
```

| Option      | Type                                                         |
| ----------- | ------------------------------------------------------------ |
| `apiKey`    | `string` (required).                                         |
| `endpoint`  | `string` — defaults to the v2 base URL.                      |
| `localeMap` | `Record<string, string>` — override BCP-47 → Google mapping. |
| `fetch`     | `FetchLike` — inject a custom HTTP layer.                    |

## Custom providers

`defineProvider` is a type-preserving identity helper:

```ts
import { defineProvider } from '@autotranslate/providers';

export const myProvider = defineProvider({
  name: 'my-service',
  signature: 'my-service:v1',
  async translate({ source, target, items, instruction, signal }) {
    // Call your service here.
    const response = await fetch('https://my-service.example.com/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source, target, items, instruction }),
      signal,
    });
    if (!response.ok) {
      throw new Error(`my-service responded ${response.status}`);
    }
    const json = (await response.json()) as {
      translations: Record<string, string>;
    };
    return { translations: json.translations };
  },
});
```

`signature` is included in the cache key. Bump it whenever the provider's
behavior changes (model swap, prompt rewrite) so stale entries invalidate.

To use a custom provider, declare `name: 'custom'` in the config and pass the
actual function to the programmatic API:

```ts
// autotranslate.config.ts
export default defineConfig({
  // …
  provider: { name: 'custom' },
});
```

```ts
// scripts/i18n.ts
import { loadConfig, translate } from '@autotranslate/cli';
import { myProvider } from './my-provider';

const resolved = await loadConfig();
await translate(resolved, { provider: myProvider });
```

The CLI binary throws if it sees `name: 'custom'` without an override — custom
providers are functions and don't survive JSON serialization.

## Hybrid strategies

Mix-and-match per locale or per entry:

```ts
import { defineProvider } from '@autotranslate/providers';
import { createAIProvider } from '@autotranslate/providers/ai';
import { createDeepLProvider } from '@autotranslate/providers/deepl';
import { isStructured } from '@autotranslate/core';

const ai = createAIProvider({ model: 'anthropic:claude-haiku-4-5' });
const deepl = createDeepLProvider({ apiKey: process.env.DEEPL_API_KEY! });

export const hybrid = defineProvider({
  name: 'hybrid',
  signature: `hybrid:${ai.signature}+${deepl.signature}`,
  async translate(request) {
    const structured = request.items.filter((i) => isStructured(i.source));
    const plain = request.items.filter((i) => !isStructured(i.source));
    const [a, b] = await Promise.all([
      ai.translate({ ...request, items: structured }),
      deepl.translate({ ...request, items: plain }),
    ]);
    return { translations: { ...a.translations, ...b.translations } };
  },
});
```

Use the `ai` provider for structured trees and DeepL for plain strings — short,
high-frequency UI copy stays cheap and fast.

## Tips

- **Pseudo-localize before AI.** `createStubProvider({ pseudo: true })` is the
  fastest way to surface untranslated UI without a model bill.

- **Set `instruction` once.** Tone and brand voice are global; configure them on
  the provider rather than appending to every key's `description`.

- **Use `$context` and `$description`.** Translators (and AI models) use them as
  disambiguation. The CLI passes both through to the provider.

- **Cache invalidates per `signature`.** Switching from
  `anthropic:claude-haiku-4-5` to `openai:gpt-4o-mini` re-translates everything.
  Bump `signature` when prompt changes affect output.
