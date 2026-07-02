---
'@autotranslate/core': major
'@autotranslate/cli': major
'@autotranslate/react': major
'@autotranslate/next': major
'@autotranslate/vite': major
'@autotranslate/providers': major
'@autotranslate/eslint-plugin': major
'@autotranslate/typescript-plugin': major
'@autotranslate/zod': major
---

`autotranslate` 1.0.0-beta — public API freeze candidate

The surface is stable enough to call. This release is published under the `beta`
npm dist-tag (`pnpm add @autotranslate/core@beta`) and exists to soak the API in
real apps before the GA cut.

What landed since 0.2:

- Chunked translation catalogs and per-chunk caching
- Per-chunk AI context-prefix for consistency across long documents
- Glossary support + first-class hybrid provider
- Streaming dev-mode translation (Vite + Next)
- Performance benchmarks published in `docs/performance.md`
- Public-API contract enumerated in `STABILITY.md`
- TypeScript Language Service plugin (`@autotranslate/typescript-plugin`)
- Migration guides for `react-i18next`, `next-intl`, `lingui`, `gt-next`

What's expected to change before 1.0 GA:

- Real-world soak (a few weeks of production use across multiple frameworks)
- A handful of additional formatter slots — `<List>` (`Intl.ListFormat`) and
  `<Unit>` (`Intl.NumberFormat({ style: 'unit' })`) at minimum
- Final pass on cookbook recipes informed by user feedback

The on-disk catalog format, runtime hashing scheme, public exports, and CLI
contracts are all considered frozen modulo bug fixes. See `STABILITY.md`.
