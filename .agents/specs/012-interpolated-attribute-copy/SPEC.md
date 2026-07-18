---
id: 012
title: Translate interpolated accessibility attributes in auto mode
slug: 012-interpolated-attribute-copy
status: done
tags: [area:cli, type:fix, auto-mode, accessibility]
priority: P0
severity: high
effort: S
risk:
  Incorrect template rewriting could create dynamic translation keys or evaluate
  interpolation expressions more than once.
planned_at: { commit: 768eca2, date: 2026-07-18 }
depends_on: [011-null-safe-forwarded-copy]
mockups:
  interface: null
  architecture: null
research: null
---

# Spec 012: Translate interpolated accessibility attributes in auto mode

> **Executor instructions**: This spec is portable - everything needed is in
> this file. Follow it top to bottom. Run every command in the AI verification
> checklist and confirm the expected result before reporting done. If a STOP
> condition fires, stop and report instead of improvising.

## Problem

Auto mode leaves interpolated JSX attributes unchanged. For example,
`aria-label={`Page ${page + 1}`}` reaches the rendered accessibility tree in
English even when the active locale is Arabic. The current regression test in
`packages/cli/src/auto-transform.test.ts` explicitly preserves interpolated
template attributes, and `isCopyBearingExpression` in
`packages/cli/src/auto-transform.ts` does not classify them as attribute copy.
This violates auto mode's contract that rendered accessibility copy is
translated and caused English pagination labels in the NexAML production
customer register.

## Mockups

- **Interface** - null because this compiler fix has no new interface.
- **Architecture** - null because the transformation remains within the existing
  attribute auto-translation pass.

## Context (self-contained)

`collectAttributeInsertions` in `packages/cli/src/auto-transform.ts` rewrites
string attributes and forwarded copy expressions to `useT()` calls while
preserving untouched source through insertion edits. Interpolated template
literals cannot be wrapped as dynamic keys because Autotranslate requires
literal catalog keys. They must instead become an ICU literal plus a parameter
object, such as `t("Page {value}", { value: page + 1 })`. The transformation
must preserve expression text, expression order, single evaluation, multiple
interpolations, and JavaScript string escaping. The extractor already records
literal `useT()` calls from transformed source. Spec
`011-null-safe-forwarded-copy` provides the current safe forwarded-copy
transformation on `main`.

## Non-goals

- Translating arbitrary JavaScript template literals outside copy-bearing JSX
  attributes.
- Rewriting server components, because attribute translation depends on the
  client-only `useT()` hook.
- Changing runtime ICU formatting or catalog storage.
- Translating machine, styling, or structural attributes.

## Instructions

1. Add a failing regression for a client component containing
   ``aria-label={`Page ${page + 1}`}`` and verify the current transform leaves
   it unchanged.
2. Extend the attribute auto-translation pre-filter so files whose only copy is
   an interpolated attribute are parsed.
3. Rewrite copy-bearing template attributes into a literal ICU key and parameter
   object while preserving each interpolation expression exactly once and in
   source order.
4. Cover one interpolation, multiple interpolations, static template attributes,
   opt-out ancestors, and non-copy attributes.
5. Confirm extraction from transformed source records the ICU literal and its
   occurrence.
6. Release the CLI and framework packages as the next beta through the existing
   release workflow.
7. Upgrade NexAML to the released beta, regenerate its catalogs, and confirm
   Arabic pagination accessibility labels in production.

## STOP conditions

- The rewrite requires a dynamic translation key.
- An interpolation expression would be evaluated more than once.
- Existing insertion ordering cannot safely represent a replacement without
  preserving all untouched source.
- The change requires a runtime or catalog format migration.

## AI verification checklist (automatable)

- [x] `pnpm --filter @autotranslate/cli test:ci` - all CLI transform and
      extraction tests pass.
- [x] `pnpm typecheck` - all package type checks pass.
- [x] `pnpm lint` - Biome reports no errors.
- [x] `CI=1 pnpm test` - the complete monorepo test suite passes.
- [x] `pnpm build` - all packages and examples build.
- [x] `pnpm packages:check` - all public package artifacts pass publint.
- [x] Generated code contains only literal translation keys and
      single-evaluation parameter expressions.

## Human verification checklist (judgment calls)

- [x] Pagination accessibility labels read naturally in Arabic.
- [x] Interpolated values remain correct after translation and reordering.
- [x] No visible or accessibility-only English interface copy remains on the
      NexAML customer register.
- [x] The deployed customer register still uses Noto Sans Arabic and RTL layout.
