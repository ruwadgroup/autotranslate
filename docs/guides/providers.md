# Providers

Providers turn source-locale entries into translations. The CLI handles
batching, concurrency, caching, and override application on top.

## Built-in providers

| Provider                          | When to use                                                             |
| --------------------------------- | ----------------------------------------------------------------------- |
| `@autotranslate/providers/stub`   | CI, tests, dev mode without credentials.                                |
| `@autotranslate/providers/ai`     | Production. Anthropic / OpenAI / Google / OpenRouter via Vercel AI SDK. |
| `@autotranslate/providers/deepl`  | Plain-string copy. Excellent quality on supported pairs.                |
| `@autotranslate/providers/google` | Plain-string copy. Cheap and fast.                                      |
| `@autotranslate/providers/hybrid` | Routes structured trees to AI, plain strings to DeepL/Google.           |

You select one in `autotranslate.config.ts`:

```ts
provider: {
  name: 'ai',
  model: 'anthropic:claude-haiku-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
}
```

## `stub`

Identity provider. Returns the source unchanged, optionally pseudo-localised.

```ts
provider: { name: 'stub' }
provider: { name: 'stub', pseudo: true }
```

`pseudo: true` accents letters and wraps text in `⟦ … ⟧`:

```
'Sign out' → '⟦ Šíǵñ óúţ ⟧'
'Welcome, {name}!' → '⟦ Ŵéĺçóɱé, {name}! ⟧'
```

Useful for surfacing untranslated UI and layout overflow during dev. ICU
placeholders, plurals, select arms, and tag wrappers all pass through verbatim.

## `ai`

Vercel AI SDK-backed. Linearises every source entry to ICU MessageFormat,
batches up to `maxBatchSize` (default 50) per `generateObject` call, and parses
the returned ICU back into the structured tree.

```ts
provider: {
  name: 'ai',
  model: 'anthropic:claude-haiku-4-5',
  apiKey: process.env.ANTHROPIC_API_KEY,
},
instruction: 'Match a casual, modern product voice.',
```

| Option   | Type     | Notes                                  |
| -------- | -------- | -------------------------------------- |
| `name`   | `'ai'`   | (required)                             |
| `model`  | `string` | `<vendor>:<model-id>` (required).      |
| `apiKey` | `string` | Falls back to vendor-default env vars. |

Top-level `instruction` is the system prompt — tone, audience, brand voice.

### Vendors

| Vendor       | Example                                 | Peer dep            |
| ------------ | --------------------------------------- | ------------------- |
| `anthropic`  | `anthropic:claude-haiku-4-5`            | `@ai-sdk/anthropic` |
| `openai`     | `openai:gpt-4o-mini`                    | `@ai-sdk/openai`    |
| `google`     | `google:gemini-2.5-flash`               | `@ai-sdk/google`    |
| `openrouter` | `openrouter:anthropic/claude-haiku-4-5` | `@ai-sdk/openai`    |

Peer deps load lazily — install only the vendor you actually use. Plus `ai` is
required by all of them:

```bash
pnpm add ai @ai-sdk/anthropic
```

ICU is the wire format because every modern frontier model knows it.
Placeholders, plurals, and tag wrappers survive round-trips reliably without
prompt-engineering gymnastics.

## `deepl`

Plain-string entries only. ICU placeholders are wrapped in opaque `[[ATPH:N]]`
sentinels before the call and restored after.

```ts
provider: {
  name: 'deepl',
  apiKey: process.env.DEEPL_API_KEY,
  endpoint: 'https://api-free.deepl.com/v2/translate', // free tier
  formality: 'prefer_more',
  context: 'developer-tool UI',
}
```

| Option      | Type                                                               |
| ----------- | ------------------------------------------------------------------ |
| `apiKey`    | `string` (required).                                               |
| `endpoint`  | `string` — defaults to `https://api.deepl.com/v2/translate`.       |
| `formality` | `'default' \| 'more' \| 'less' \| 'prefer_more' \| 'prefer_less'`. |
| `context`   | `string` — passed through to DeepL.                                |
| `localeMap` | `Record<string, string>` — override BCP-47 → DeepL mapping.        |

Plural / select / pound (`#`) / tag entries throw — route those through the `ai`
provider, or pair the two with a [hybrid setup](#hybrid-strategies).

## `google`

Same scope as DeepL. Google Cloud Translation v2.

```ts
provider: {
  name: 'google',
  apiKey: process.env.GOOGLE_API_KEY,
}
```

| Option      | Type                                                         |
| ----------- | ------------------------------------------------------------ |
| `apiKey`    | `string` (required).                                         |
| `endpoint`  | `string` — defaults to the v2 base URL.                      |
| `localeMap` | `Record<string, string>` — override BCP-47 → Google mapping. |

## Custom providers

Anything else — local LLMs, internal services, glossary lookups — is a small
function. See [Custom provider](../cookbook/custom-provider.md) for a
walk-through.

## Hybrid strategies

Mix-and-match per locale or per entry. The pattern: route plain strings to
DeepL/Google for cost/quality, route structured trees to AI for ICU correctness.
See [Custom provider](../cookbook/custom-provider.md) for the hybrid recipe.

## Tips

- **Pseudo-localise before AI.** `provider: { name: 'stub', pseudo: true }`
  surfaces untranslated UI without a model bill.

- **Set `instruction` once.** Tone and brand voice are global; configure them on
  the provider rather than appending to every key's `description`.

- **Use `$context` and `$description`.** Translators (and AI models) use them as
  disambiguation. The CLI passes both through to the provider.

- **Cache invalidates per provider signature.** Switching from
  `anthropic:claude-haiku-4-5` to `openai:gpt-4o-mini` re-translates everything.
  That's by design.
