---
id: 001
title: The plugin is the product - zero-command DX + docs truth pass
slug: 001-plugin-is-the-product
status: done
tags: [type:feat, type:docs, area:cli, area:next, area:vite, area:core, epic:dx-reconcept]
priority: P1
severity: high
effort: L
risk: dev-loop or frozen-check misbehavior could break consumers' dev servers/builds; auto-mode transform could wrap non-copy text
planned_at: { commit: ade28f8a55830e167a8e60e97ba05eb9eccef34c, date: 2026-07-02 }
depends_on: []
mockups:
  interface: null
  architecture: arch.md
research: null
---

# Spec 001: The plugin is the product - zero-command DX + docs truth pass

> **Status: executed and merged to main on 2026-07-02.**
> This file was reconstructed after the working copy of the spec folder was
> lost during the repo-wide file purge; the content below reflects the spec as
> executed, including the owner directives added mid-flight.

## Problem

autotranslate's philosophy says catalogs are derived artifacts "like TypeScript declarations", but the DX did not cash that check.
A new adopter performed ~13 steps: install 4-5 packages, hand-edit config, wire a proxy, wrap a layout, wrap next.config, then run `extract && translate && generate-types` manually and wire the same chain into CI.
Production catalog delivery read the filesystem at request time, which caused the beta.2 standalone-output incident and blocked edge runtimes.
Separately, the docs had drifted from the code in 17+ places.

Target end state (see `arch.md`): install one package, run `init` once, then translations appear on save in dev, builds verify the committed catalog like a lockfile and never call a model, `mode: 'auto'` optionally wraps JSX text at compile time, a `parity` command powers PR review, the TS plugin shows translations inline, and every doc tells the truth.

## Owner directives absorbed during execution (2026-07-02)

- Backward compatibility explicitly NOT a goal; remove legacy/deprecated paths outright.
- Root reorganized to the twinfold convention (community files in `.github/`, stability folded into README).
- File purge: root CHANGELOG stub, docs/overview, docs/installation, docs/stability, docs/faq, docs/performance deleted and folded.
- Zero `any`, zero lint warnings; dependency update pass (typescript 6, babel 8, ai 7 held back deliberately).
- Comment purge (~153 removed) plus a taste pass adding missing constraint comments.
- README and the entire docs tree rewritten from the user's perspective.
- Post-execution feature audit applied: dictionary mode, hybrid provider, catalog.chunkBits option, miss-stats API, cli-progress dep, Tx marker, experiments package, and the multi-tenant / adding-a-locale / branded-glossary / ab-copy recipes removed.

## Executed units

- A1 docs truth pass (17-defect ledger) - codex
- A2 legacy purge: streaming handlers, createDevOnMissing, migrate-format + distributed flat-fallback/migration-shim removal
- A3 root reorg to twinfold convention - codex
- A4 file purge (CHANGELOG stub, overview, installation, stability, faq, performance)
- A5 zero-any / zero-warning lint pass
- A6 comment purge; A7 dependency updates
- B1 config fields (mode, build; chunkBits later removed by audit)
- B2 generated catalog module (`writeCatalogModule` -> `<outDir>/index.ts`)
- B3 shared classifier in core (`@autotranslate/core/classifier`), eslint rewire
- C1 `createDevLoop` (chokidar v4, debounced, serialized, never-throwing)
- C2 `collectExtraction` + `checkFrozen`/`formatFrozenReport` (catalogAbsent grace)
- D1 phase-aware `withAutotranslate` (dev loop singleton, frozen build, translateOnBuild)
- D2 module-based `getT` (`{ module | load }` required; fsCatalogLoader deleted)
- D3 vite plugin: dev loop + frozen buildStart + auto transform
- D4 `init` overhaul (framework detection, AST next.config wrap, proxy scaffold, idempotent steps)
- E1/E2/E3 auto mode: `mode:'auto'`, `transformAutoWrap` (single-`<T>` runs spanning clean inline elements, block-vs-copy guard, `data-no-translate` splits), bundler wiring (webpack + turbopack + vite)
- F1 `parity` command + PR cookbook; F2 TS-plugin inlay hints; F3 docs rewrite + changeset
- Examples converted to reference implementations with committed catalogs building through the frozen gate

## Verification (final, post-audit)

- `pnpm lint` 0 errors / 0 warnings; `pnpm format:check` clean
- `pnpm typecheck` 17/17; `pnpm test:ci` 17/17; `pnpm build` 11/11 (both examples pass the frozen gate)
- All relative links across README/docs resolve; purge greps clean
- Landed on `main` in commits: `feat!: the plugin is the product - zero-command DX reconcept`, `docs: rewrite for the zero-command flow; reorganize root`, `chore: update root dev dependencies`, plus this spec record.

## Human verification checklist (open)

- [ ] `pnpm dev` in `examples/next-app` with a real provider key: save a new string, confirm the translated locale hot-updates in seconds
- [ ] Production build with one translation deleted: failure message reads well
- [ ] `npx autotranslate init` output reads well; manual diffs copy-pasteable
- [ ] Parity markdown renders correctly as a GitHub comment
- [ ] Auto mode on a real page: nothing wrapped that shouldn't be, nothing missed
- [ ] Inlay hints legible in a real editor session
- [ ] Docs read coherently end-to-end
