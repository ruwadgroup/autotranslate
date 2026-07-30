# Providers

Providers turn source-locale entries into translations. In development, the
framework plugin's dev loop calls the provider on every save automatically - no
commands to run. In CI or scripting contexts, `autotranslate translate` drives
the same logic explicitly. The CLI handles diffing, batching, concurrency, and
override application regardless of how it's invoked.

## Built-in providers

| Provider | When to use                                                                          |
| -------- | ------------------------------------------------------------------------------------ |
| `stub`   | CI, tests, dev mode without credentials.                                             |
| `ai`     | Production. Anthropic / OpenAI / Google / OpenRouter via Vercel AI SDK.              |
| `agent`  | Local dev with no API key - drives Claude Code or Codex on your existing plan.       |
| `deepl`  | Plain-string copy. Excellent quality on supported pairs.                             |
| `google` | Plain-string copy. Cheap and fast.                                                   |
| `custom` | Any service not listed above. See [Custom provider](../cookbook/custom-provider.md). |

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

`pseudo: true` accents letters and wraps text in `⟦ ... ⟧`:

```
'Sign out' -> '⟦ Šíǵñ óúţ ⟧'
'Welcome, {name}!' -> '⟦ Ŵéĺçóɱé, {name}! ⟧'
```

Useful for surfacing untranslated UI and layout overflow during dev. ICU
placeholders, plurals, select arms, and tag wrappers all pass through verbatim.

## `ai`

Vercel AI SDK-backed. Linearises every source entry to ICU MessageFormat,
batches per `generateObject` call, and parses the returned ICU back into the
structured tree.

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

Top-level `instruction` is the system prompt - tone, audience, brand voice.

### Vendors

| Vendor       | Example                                 | Peer dep            |
| ------------ | --------------------------------------- | ------------------- |
| `anthropic`  | `anthropic:claude-haiku-4-5`            | `@ai-sdk/anthropic` |
| `openai`     | `openai:gpt-4o-mini`                    | `@ai-sdk/openai`    |
| `google`     | `google:gemini-2.5-flash`               | `@ai-sdk/google`    |
| `openrouter` | `openrouter:anthropic/claude-haiku-4-5` | `@ai-sdk/openai`    |

Peer deps load lazily - install only the vendor you actually use. `ai` is
required by all of them:

```bash
pnpm add ai @ai-sdk/anthropic
```

ICU is the wire format because every modern frontier model knows it.
Placeholders, plurals, and tag wrappers survive round-trips reliably without
prompt-engineering gymnastics.

## `agent`

Drives a headless coding-agent CLI already installed and signed in on the
machine - [Claude Code](https://claude.com/claude-code) or
[Codex](https://developers.openai.com/codex/cli). No API key, no separate
billing: translation runs on the subscription you already pay for.

```ts
provider: {
  name: 'agent',
  agent: 'claude',            // or 'codex'
  model: 'claude-haiku-4-5',  // optional; the agent's default otherwise
}
```

| Option      | Type                  | Notes                                             |
| ----------- | --------------------- | ------------------------------------------------- |
| `name`      | `'agent'`             | (required)                                        |
| `agent`     | `'claude' \| 'codex'` | Default `'claude'`.                               |
| `model`     | `string`              | Passed through to the CLI.                        |
| `command`   | `string`              | Override the executable when it is not on `PATH`. |
| `args`      | `string[]`            | Extra CLI arguments.                              |
| `timeoutMs` | `number`              | Hard timeout per invocation. Default `300000`.    |

The agent is used strictly as a text transformer: tools are disabled, the
sandbox is read-only, and the prompt goes in on stdin. It cannot touch your
repository.

- **Claude Code** runs `claude -p --output-format json --disallowedTools '*'`.
- **Codex** runs `codex exec --sandbox read-only` with `--output-schema`, so the
  response shape is enforced by the API rather than by prompt discipline.

Each batch is a process spawn, so this is slower than `ai` and suits local
development and small-to-medium catalogs rather than bulk runs. Keep
`concurrency` modest (2-4). CI runners do not carry your agent login, so use a
key there:

```ts
provider:
  process.env.CI === 'true'
    ? { name: 'ai', model: 'anthropic:claude-haiku-4-5' }
    : { name: 'agent', agent: 'claude' },
```

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
| `endpoint`  | `string` - defaults to `https://api.deepl.com/v2/translate`.       |
| `formality` | `'default' \| 'more' \| 'less' \| 'prefer_more' \| 'prefer_less'`. |
| `context`   | `string` - passed through to DeepL.                                |
| `localeMap` | `Record<string, string>` - override BCP-47 to DeepL mapping.       |

Plural / select / pound (`#`) / tag entries throw - route those through the `ai`
provider or a custom provider. See
[Custom provider](../cookbook/custom-provider.md) for a hand-rolled hybrid
approach.

## `google`

Same scope as DeepL. Google Cloud Translation v2.

```ts
provider: {
  name: 'google',
  apiKey: process.env.GOOGLE_API_KEY,
}
```

| Option      | Type                                                          |
| ----------- | ------------------------------------------------------------- |
| `apiKey`    | `string` (required).                                          |
| `endpoint`  | `string` - defaults to the v2 base URL.                       |
| `localeMap` | `Record<string, string>` - override BCP-47 to Google mapping. |

## Custom providers

Anything else - local LLMs, internal services, glossary lookups - is a small
function. See [Custom provider](../cookbook/custom-provider.md) for a
walk-through.

## Tips

- **Pseudo-localise before AI.** `provider: { name: 'stub', pseudo: true }`
  surfaces untranslated UI without a model bill.

- **Set `instruction` once.** Tone and brand voice are global; configure them on
  the provider rather than appending to every key's `description`.

- **Use `$context` and `$description`.** Translators (and AI models) use them as
  disambiguation. The CLI passes both through to the provider.

- **Switching providers does not re-translate.** Translations on disk stay valid
  whichever model produced them. To deliberately redo a locale, delete its
  catalog and `.state/` directories.

## Batching and failure handling

The CLI, not the provider, decides how work is split:

1. Each locale is diffed against its committed catalog; unchanged strings are
   never re-sent.
2. Identical copy is collapsed to one request item, then fanned back out across
   every key sharing it.
3. The remainder is split into uniform `batchSize` batches (default 25) and run
   at `concurrency`.

`batchSize` is the lever when a model starts dropping items from large
responses. Short batches cost more requests; long ones cost accuracy.

Batches fail independently: a failed batch leaves its keys at their previous
translation and is reported at the end, while the rest of the run commits. Keys
a model silently omits are never written as holes - they stay out of the state
file, so the next run retries exactly those. `translate` exits non-zero when any
batch failed, so CI does not mistake a partial run for a green one.
