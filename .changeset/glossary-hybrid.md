---
'@autotranslate/core': minor
'@autotranslate/providers': minor
'@autotranslate/cli': minor
---

Glossary support + first-class hybrid provider

**`glossary` config field** — a flat array of brand / proper-noun terms the AI
must never translate or transliterate. The CLI prepends the glossary to the
provider's instruction at translate time.

```ts
defineConfig({
  // …
  glossary: ['autotranslate', 'API', 'SDK'],
  instruction: 'Friendly tone.',
});
```

The merged instruction the provider receives:

```
Glossary — preserve these terms exactly; never translate or transliterate:
- autotranslate
- API
- SDK

Friendly tone.
```

**`hybrid` provider** — built-in provider that routes structured-tree entries
(`<T>` blocks, plurals, branches) to an `ai` provider and plain strings (`useT`
literals, dictionary keys) to DeepL or Google.

```ts
provider: {
  name: 'hybrid',
  ai: { name: 'ai', model: 'anthropic:claude-haiku-4-5', apiKey: process.env.ANTHROPIC_API_KEY },
  plain: { name: 'deepl', apiKey: process.env.DEEPL_API_KEY },
}
```

Lives at `@autotranslate/providers/hybrid` (`createHybridProvider`). Cache
signature combines both providers' signatures.
