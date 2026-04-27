# Roadmap

Public, intentionally narrow. Expect cuts and reorders — file an issue if a
milestone matters to you.

## v0.1 — Core extractor + React runtime

- [x] `@autotranslate/core` — config schema (Zod), `defineConfig`, locale
      resolver, ICU parser, hashing
- [x] `@autotranslate/cli` — `init`, `extract`, `translate`, `check`
- [x] `@autotranslate/providers` — `stub`, `ai` (Anthropic, OpenAI, Google,
      OpenRouter)
- [x] `@autotranslate/react` — `<T>`, `<Var>`, `<Plural>`, `<Branch>`, `useT`,
      `<TranslationProvider>`
- [x] `examples/vite-react` end-to-end
- [x] CI green on Linux / macOS / Windows × Node 20 / 22

## v0.2 — Next.js + RSC

- [x] `@autotranslate/next` — `withAutotranslate`, `createNextMiddleware`,
      `getT`, `getTranslations`
- [x] App Router catalog loading (memoized per request)
- [x] `examples/next-app` end-to-end
- [x] Locale routing — prefix and cookie strategies

## v0.3 — Vite plugin + virtual modules

- [x] `@autotranslate/vite` — virtual locale modules + HMR
- [x] Build-time catalog inlining
- [ ] Streaming dev-mode translation (translate on first miss)

## v0.4 — Type generation + ESLint plugin

- [x] `autotranslate generate-types`
- [x] `@autotranslate/eslint-plugin` — `no-untranslated-jsx`, `no-dynamic-key`,
      `valid-icu-format`
- [ ] Editor diagnostics for missing keys

## v0.5 — More providers

- [x] `@autotranslate/providers/deepl`
- [x] `@autotranslate/providers/google`
- [ ] Hybrid mode — MT for short / unambiguous strings, AI for the rest
- [ ] Glossary support (per-tenant terminology)

## v0.6 — MCP + agentic workflow

- [ ] `@autotranslate/mcp` — tools for `extract`, `translate`, `check`,
      `add-locale`
- [ ] Cursor / Claude Code recipes in docs

## v1.0 — Stability & ergonomics

- [ ] Public API freeze
- [ ] Migration guides from `react-i18next`, `next-intl`, `lingui`, `gt-next`
- [ ] Cookbook with framework recipes
- [ ] Performance — translator < 50µs/call, catalog gzip < 5kb for 100 strings

## Beyond v1

- Vue, Svelte, Solid adapters
- React Native / Expo first-class
- Edge KV catalog backend
- AI-driven glossary inference
- Snapshot diff in PR comments (locale parity check)
