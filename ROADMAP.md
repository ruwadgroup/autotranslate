# Roadmap

Public, intentionally narrow. Expect cuts and reorders — file an issue if a
milestone matters to you.

## v0.1 — Core extractor + React runtime

- [ ] `@autotranslate/core`: config schema (Zod), `defineConfig`, locale
      resolver, ICU parser, hashing
- [ ] `@autotranslate/cli`: `init`, `extract`, `translate`, `check`
- [ ] `@autotranslate/providers`: `stub`, `ai` (OpenAI / Anthropic / OpenRouter)
- [ ] `@autotranslate/react`: `<T>`, `<Var>`, `<Plural>`, `useT`,
      `TranslationProvider`
- [ ] `examples/vite-react` working end-to-end
- [ ] CI green on Linux/macOS/Windows × Node 20/22

## v0.2 — Next.js + RSC

- [ ] `@autotranslate/next`: `withAutotranslate`, `createNextMiddleware`, `getT`
- [ ] App Router catalog loading (cached per request)
- [ ] `examples/next-app` end-to-end
- [ ] Locale routing with prefix / domain / cookie strategies

## v0.3 — Vite plugin + virtual modules

- [ ] `@autotranslate/vite` virtual locale modules + HMR
- [ ] Build-time catalog inlining
- [ ] Streaming dev-mode translation (translate on first miss)

## v0.4 — Type generation + ESLint plugin

- [ ] `autotranslate generate-types`
- [ ] `@autotranslate/eslint-plugin`: `no-untranslated-jsx`, `no-dynamic-key`,
      `valid-icu-format`, `no-orphan-translation`
- [ ] Editor diagnostics for missing keys

## v0.5 — More providers

- [ ] `@autotranslate/providers/deepl`
- [ ] `@autotranslate/providers/google`
- [ ] Hybrid mode: MT for short / unambiguous strings, AI for the rest
- [ ] Glossary support (per-tenant terminology)

## v0.6 — MCP + agentic workflow

- [ ] `@autotranslate/mcp`: tools for `extract`, `translate`, `check`,
      `add-locale`
- [ ] Cursor / Claude Code recipe in docs

## v1.0 — Stability & ergonomics

- [ ] Public API freeze
- [ ] Migration guides from `ai18n`, `react-i18next`, `next-intl`, `gt-next`
- [ ] Cookbook with framework recipes
- [ ] Performance: translator < 50µs/call, catalog gzip < 5kb for 100 strings

## Beyond v1

- Vue, Svelte, Solid adapters
- React Native / Expo first-class
- Edge KV catalog backend
- AI-driven glossary inference
- Snapshot diff in PR comments (locale parity check)
