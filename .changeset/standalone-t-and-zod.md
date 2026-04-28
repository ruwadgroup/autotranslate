---
'@autotranslate/core': minor
'@autotranslate/zod': minor
'@autotranslate/cli': minor
'@autotranslate/react': patch
'@autotranslate/providers': patch
---

Add standalone `t()` and `@autotranslate/zod` integration

- `@autotranslate/core` now exports `bindTranslator`, `withTranslator`,
  `currentTranslator`, and a synchronous `t(key, params)` from
  `@autotranslate/core/standalone` and `@autotranslate/core/t`. The Node entry
  uses `AsyncLocalStorage` for per-request isolation; browsers fall back to a
  module slot via the `browser` export condition.
- `AutotranslateCatalog` augmentation point moved to `@autotranslate/core`.
  `@autotranslate/react` re-exports it for ergonomics.
  `autotranslate generate-types` augments core only — re-run it after upgrading.
- The CLI extractor recognizes `import { t } from '@autotranslate/core/t'` (and
  `/standalone`) so non-React call sites flow through the same extraction +
  translation pipeline.
- New `@autotranslate/zod` package: a Zod v4 error map that translates standard
  issues through the active translator, with bundled English fallbacks and
  adapter sub-paths for Next (`@autotranslate/zod/next`) and Remix
  (`@autotranslate/zod/remix`). Add `@autotranslate/zod/source` to your
  `content` glob to pipe the keys through your usual translation flow.
- Workspace bumped to Zod v4 (`zod ^4.0.0`). `@autotranslate/core/config`
  swapped `.url()` for `z.url()` and `z.SafeParseReturnType` for
  `z.ZodSafeParseResult`.
