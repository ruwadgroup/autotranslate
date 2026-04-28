# Stability

This document defines what's covered by semantic versioning, what's explicitly
mutable, and what we promise about upgrades.

## Status

**Pre-1.0.** Until `@autotranslate/core` reaches `1.0.0`, breaking changes can
land in any minor release. Pin exact versions if your project can't tolerate
surprises.

`0.x.y` ranges:

- `0.x` minor bumps may break the public API. Read the changeset.
- `0.x.y` patch bumps are non-breaking — bug fixes, perf, doc edits.

Once 1.0.0 lands, semver applies strictly. Major bumps for breaking changes;
minor for additive features; patch for fixes.

## Public API

Anything exported from a package's main entry or a documented sub-path is part
of the public surface.

| Package                                                  | Public surface                                                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@autotranslate/core`                                    | `createTranslator`, `Translator`, `TranslatorOptions`, `Catalog*`, `Locale`, `MessageMeta*`, `Manifest`, `*Node`, `StructuredMessage`, `AutotranslateCatalog`, `CatalogKey`, `hash`, `shortHash`, `canonicalKey`, `isStructured`, `renderTreeToString` |
| `@autotranslate/core/config`                             | `defineConfig`, `parseConfig`, `safeParseConfig`, all `*ProviderConfig` types, `AutotranslateConfig`, `AutotranslateConfigInput`                                                                                                                       |
| `@autotranslate/core/locale`                             | `matchLocale`, `getDirection`, `isValidLocale`, `parseAcceptLanguage`, `getPluralCategory`, related types                                                                                                                                              |
| `@autotranslate/core/icu`                                | `formatICU`, `extractVariables`, `ICUParseError`                                                                                                                                                                                                       |
| `@autotranslate/core/standalone`, `/t`                   | `bindTranslator`, `withTranslator`, `currentTranslator`, `t`                                                                                                                                                                                           |
| `@autotranslate/react`                                   | `<T>`, markers, `<TranslationProvider>`, `useT`, `useTranslations`, `useLocale`, `createDevOnMissing`                                                                                                                                                  |
| `@autotranslate/react/server`                            | `getT`, `createTranslator`                                                                                                                                                                                                                             |
| `@autotranslate/next`                                    | `getT`, `getTranslations`, `getRequestLocale`, `fsCatalogLoader`, `clearCatalogCache`                                                                                                                                                                  |
| `@autotranslate/next/middleware`                         | `createNextMiddleware`                                                                                                                                                                                                                                 |
| `@autotranslate/next/plugin`                             | `withAutotranslate`                                                                                                                                                                                                                                    |
| `@autotranslate/next/streaming`                          | `createStreamingHandler`, default `POST` export                                                                                                                                                                                                        |
| `@autotranslate/vite`                                    | default plugin export, `AutotranslatePluginOptions`, `VIRTUAL_MODULE_ID`                                                                                                                                                                               |
| `@autotranslate/cli`                                     | `loadConfig`, `init`, `extract`, `translate`, `generateTypes`, `check`, related result types                                                                                                                                                           |
| `@autotranslate/providers`                               | `Provider`, `TranslationItem`, `TranslationRequest`, `TranslationResult`, `defineProvider`, `createStubProvider`, `pseudoLocalize`                                                                                                                     |
| `@autotranslate/providers/{ai,deepl,google,stub,hybrid}` | factories listed in the providers guide                                                                                                                                                                                                                |
| `@autotranslate/zod`                                     | `zodErrorMap`, `createZodErrorMap`, `issueToLookup`                                                                                                                                                                                                    |
| `@autotranslate/zod/{next,remix}`                        | `withRequestTranslator`                                                                                                                                                                                                                                |
| `@autotranslate/eslint-plugin`                           | default plugin export, rules and configs                                                                                                                                                                                                               |
| `@autotranslate/experiments`                             | `<ExperimentProvider>`, `<Experiment>`, `<Variant>`, `useExperiment`, `useExperimentContext`                                                                                                                                                           |

## Explicitly internal

Anything under `@autotranslate/core/internal` is **not** part of the public
surface, even pre-1.0. Workspace packages depend on it; external code shouldn't.

`/internal` exports today: `BRANCH_RESERVED_PROPS`, `FORMAT_MARKER_PREFIX`,
`MARKER_NAMES`, `mergeAdjacentText`, `TREE_KEY_PREFIX`, `canonicalize`,
`applyContextToKey`, `CONTEXT_KEY_SEPARATOR`, `chunkPathFor`,
`buildChunkLayout`.

If you reference these and they break, that's expected.

## On-disk format

The `.translations/` chunked tree, the `.cache/` layout, and the manifest shape
are part of the contract. Migrations are silent and idempotent — the runtime +
CLI both know how to read older formats while a project is upgrading. Format
breaks only happen at minor bumps pre-1.0.

## Provider signatures

A `Provider.signature` is part of the cache key. We commit to:

- Built-in provider signatures change only when their behaviour changes (model
  swap, prompt rewrite). Cache invalidation when this happens is deliberate.
- The shape `<name>:<vendor-or-detail>:<short-hash>?` may evolve; treat the
  signature as opaque.

## What's allowed to break in any pre-1.0 release

- The `/internal` sub-path of any package.
- Naming and organisation of cookbook recipes (URLs may move).
- Default values of optional config fields (e.g. `concurrency` could rise from 8
  to 16).
- The exact text of `instruction` preambles produced by the CLI when glossary
  entries are configured.
- Performance characteristics — we may swap algorithms.

## What we won't break in a pre-1.0 release without an opt-in

- The `<T>` / `useT` / standalone `t()` call signatures.
- The catalog merge order (overrides > catalog > fallback).
- The chunked-on-disk layout (additive evolution only).
- Existing config field shapes (additive evolution only).
- The `Translator` interface.

## Reporting

If something is unclear or you think we've broken a stable surface,
[open an issue](https://github.com/tamimbinhakim/autotranslate/issues/new).
Pre-1.0 we treat reasonable surface confusions as bugs to fix in docs.
