---
'@autotranslate/providers': minor
---

Initial implementation of `@autotranslate/providers`:

- `Provider` interface,
  `TranslationItem`/`TranslationRequest`/`TranslationResult` types, and
  `defineProvider` identity helper.
- `createStubProvider({ pseudo? })` — identity / pseudo-localization provider
  for tests and dev mode. Pseudo mode accents Latin letters, wraps in expansion
  brackets, and preserves ICU placeholders + structured-tree slots verbatim.
- `createAIProvider({ model, apiKey, instruction?, maxBatchSize?, resolveModel? })`
  on the `/ai` subpath — Vercel AI SDK provider with lazy vendor imports for
  `anthropic:`, `openai:`, `google:`, and `openrouter:` model strings.
  Internally linearizes structured trees to ICU MessageFormat, batches via
  `generateObject` against a Zod schema, and reconstructs trees on return so
  placeholders and plurals survive translation.
- DeepL and Google Cloud Translation placeholders on `/deepl` and `/google` that
  throw with a clear message — landing in v0.5 per the roadmap.
- Tree ↔ ICU helpers (`treeToICU`, `icuToTree`) used by the AI provider; the
  round-trip is lossless for text, vars, plurals, and tag wrappers.
