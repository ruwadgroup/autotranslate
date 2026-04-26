---
'@autotranslate/cli': minor
---

Initial implementation of `@autotranslate/cli`:

- **`autotranslate init`** scaffolds `autotranslate.config.ts`.
- **`autotranslate extract`** scans source files matched by `config.content`
  with `@babel/parser`, extracts `<T>...</T>` JSX blocks (linearized to
  `StructuredMessage` and hashed via `canonicalKey`) and `useT()` literal calls
  (where `t` is bound to a `useT()` invocation), and writes
  `<outDir>/<source>.json` + `<outDir>/.meta.json`. Whitespace collapse matches
  the runtime walker so canonical keys are identical at extract and render time.
- **`autotranslate translate`** loads the source catalog, runs a content- hashed
  cache, applies per-locale overrides, calls the configured provider for the
  diff, and writes per-locale catalogs + an updated cache file. `-l, --locale`
  restricts to a subset of targets.
- **`autotranslate check`** verifies catalog parity (missing keys, orphan keys,
  invalid ICU strings) and exits non-zero on problems — drop-in for CI.
- All commands are also exported as a programmatic API (`loadConfig`, `extract`,
  `translate`, `check`, `init`); the programmatic path is the only way to use a
  `name: 'custom'` provider.
- Lazy imports on AI vendors so users don't need any `@ai-sdk/*` peer dep
  installed unless they actually configure `provider.name === 'ai'`.
