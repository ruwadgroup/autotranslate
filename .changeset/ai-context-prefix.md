---
'@autotranslate/providers': minor
'@autotranslate/cli': minor
---

AI provider receives within-chunk context for consistency

`TranslationRequest` gains an optional `context` field — already-translated
neighbours from the same chunk. The CLI populates it during `translate` per
chunk: keys whose cache hit is fresh become reference for keys that need
re-translation.

The bundled `ai` provider passes the context to the model as a `reference`
section in the prompt, alongside the changed strings. The system prompt explains
that reference items are read-only — the model returns translations only for the
items in the `translate` array.

Marks the system prompt as `cacheControl: { type: 'ephemeral' }` for Anthropic —
no-op for short prompts, automatic 90% input savings on cached tokens for large
`instruction` blocks. OpenAI does prompt caching automatically beyond ~1024
tokens; other vendors ignore the option.

Net effect: when one string in a 50-string chunk changes, the AI sees the 49
unchanged neighbours' translations as reference and produces output consistent
with the surrounding copy. No behaviour change for single-string-per-chunk
cases.
