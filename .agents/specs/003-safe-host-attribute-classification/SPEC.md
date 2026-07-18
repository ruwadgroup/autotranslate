---
id: 003
title: Restrict auto-mode host attributes to user-facing copy
slug: 003-safe-host-attribute-classification
status: go
tags: [area:core, area:cli, area:eslint, type:fix, auto-mode]
priority: P0
severity: critical
effort: M
risk:
  An incomplete positive set can miss accessibility copy, while an over-broad
  set can translate browser or SVG control tokens and break rendering.
planned_at:
  { commit: 99649c7c8cd252a8b436296e509d70eca705fa01, date: 2026-07-18 }
depends_on: []
mockups:
  interface: null
  architecture: arch.md
research: null
---

# Spec 003: Restrict auto-mode host attributes to user-facing copy

> **Executor instructions**: This spec is portable. Follow it top to bottom, run
> every AI verification command, and stop if a STOP condition applies.

## Problem

`isTranslatableAttribute()` currently returns the exact complement of a 35-name
structural allowlist. That closed-world assumption is unsafe for the open-ended
HTML, SVG, ARIA, React, and library attribute space. Any unknown static string
attribute is treated as human copy, rewritten to `t("...")`, extracted, and sent
for translation.

A real beta.8 consumer, NexAML, upgraded its auto-mode extractor and immediately
gained 122 missing Arabic keys. Most were not copy. False positives included
`viewBox="0 0 220 126"`, `role="listbox"`, `accept=".csv,text/csv"`,
`aria-live="polite"`, `vectorEffect="none"`, `fill="var(--foreground)"`,
`strokeLinecap="round"`, `textAnchor="middle"`, `shapeRendering="crispEdges"`,
numeric chart geometry, CSS colors, DOM IDs, and SVG namespaces. Translating
those values can break file inputs, accessibility semantics, QR codes, charts,
and visual styling.

The classifier must use a positive contract for user-facing host attributes.
Unknown attributes must remain untouched by the compiler and unreported by the
lint rule. The supported copy set must include visual and accessibility copy
such as `title`, `placeholder`, `alt`, `label`, `aria-label`,
`aria-description`, `aria-placeholder`, `aria-roledescription`, and
`aria-valuetext`.

## Mockups

- **Interface**: `null` because this is a compiler safety fix with no direct UI
  design.
- **Architecture**: `arch.md` defines the positive classification contract and
  the expected compiler, extractor, and lint behavior.

## Context (self-contained)

The repository is a pnpm and Turborepo TypeScript monorepo. The relevant
verification commands are `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm build`, and `pnpm packages:check`.

`packages/core/src/classifier.ts:36-99` defines a 35-entry
`ALLOWLIST_ATTRIBUTES_SET`, `isAllowlistedAttribute()`, and
`isTranslatableAttribute(name) = !isAllowlistedAttribute(name)`.
`packages/cli/src/auto-transform.ts:542-591` calls `isTranslatableAttribute()`
before rewriting a static host attribute to `t()` in client modules. The
auto-mode extractor runs the same transform first, so every rewrite also becomes
a catalog key. `packages/eslint-plugin/src/rules/no-untranslated-jsx.ts:108-144`
currently reports every static attribute that is not allowlisted, and suppresses
every host attribute in auto-mode client modules.

`CLASSIFIER_VERSION` is currently `3` and must change because the classification
contract changes. The beta release workflow runs on pushes to `main`, uses
Changesets, and publishes through GitHub Actions OIDC Trusted Publishing. Do not
edit generated `CHANGELOG.md` files manually.

## Non-goals

- Translating arbitrary custom-component props.
- Translating structural DOM, SVG, ARIA, React, testing, styling, navigation,
  form-control, or library-specific tokens.
- Solving element-sensitive copy such as `<input type="submit" value="Save">` in
  this patch. `value` remains structural until the classifier API can safely
  inspect the host element and input type.
- Translating dynamic attribute values or template literals with expressions.
- Expanding auto mode to server-component attributes.

## Instructions

1. Replace the complement-based host-attribute rule in
   `packages/core/src/classifier.ts` with an explicit immutable set of
   user-facing copy attributes. Include `title`, `placeholder`, `alt`, `label`,
   `aria-label`, `aria-description`, `aria-placeholder`, `aria-roledescription`,
   and `aria-valuetext`. Keep `isAllowlistedAttribute()` for compatibility, but
   do not use its complement as the translation decision. Bump
   `CLASSIFIER_VERSION` to `4`.
2. Expand classifier tests to prove every supported copy attribute returns
   `true` and a broad regression matrix of structural HTML, SVG, ARIA, CSS,
   numeric, and custom attributes returns `false`. Remove the obsolete
   complement assertion.
3. Keep the CLI transform wired to the shared positive predicate. Add regression
   cases proving supported copy attributes are rewritten while `viewBox`,
   `role`, `accept`, `aria-live`, `vectorEffect`, `fill`, `stroke`,
   `strokeLinecap`, `textAnchor`, `shapeRendering`, XML namespaces, IDs, CSS
   variables, numeric geometry, and unknown attributes remain byte-identical.
4. Add an extractor regression that mixes copy and structural attributes and
   proves only the copy values enter the source catalog.
5. Change `no-untranslated-jsx` to use the shared positive predicate. Explicit
   mode must report supported user-facing copy attributes and ignore structural
   unknowns. Auto mode must suppress only supported copy attributes that the
   compiler handles in client host elements. Server-component and
   custom-component handling must remain unchanged for supported copy
   attributes.
6. Update the attribute-auto-translation documentation in `ARCHITECTURE.md`,
   `docs/reference/configuration.md`, `docs/guides/strings.md`,
   `docs/guides/jsx.md`, and `docs/guides/linting.md` to describe a positive
   copy set rather than an allowlist complement.
7. Add a patch changeset for `@autotranslate/core`, `@autotranslate/cli`, and
   `@autotranslate/eslint-plugin`.
8. Run every verification command, commit, push `main`, wait for the release
   workflow, merge the generated version PR if the configured workflow requires
   it, and verify the new beta package versions and npm dist-tags.
9. Validate the release in the NexAML consumer by regenerating catalogs. The
   122-key beta.8 delta must collapse to genuine user-facing copy, with no
   structural tokens in the missing-target report.

## STOP conditions

- A supported attribute name is context-sensitive in a way that makes name-only
  classification unsafe.
- The CLI, extractor, and lint rule cannot share one predicate without diverging
  behavior.
- Existing public consumers depend on the complement behavior for custom
  attributes that are genuinely user-facing.
- The release workflow requests manual npm credentials instead of Trusted
  Publishing.
- The NexAML consumer still extracts structural tokens after installing the
  fixed packages.

## AI verification checklist (automatable)

- [ ] `pnpm --filter @autotranslate/core test` passes with the positive-set
      matrix and classifier version `4`.
- [ ] `pnpm --filter @autotranslate/cli exec vitest run src/auto-transform.test.ts src/commands/extract/extractor.test.ts`
      passes.
- [ ] `pnpm --filter @autotranslate/eslint-plugin test` passes.
- [ ] `pnpm typecheck` reports zero errors.
- [ ] `pnpm lint` is clean.
- [ ] `pnpm test` passes across the monorepo.
- [ ] `pnpm build` succeeds for every package.
- [ ] `pnpm packages:check` validates package contents and exports.
- [ ] The changeset exists and requests patch releases for Core, CLI, and ESLint
      plugin.
- [ ] NexAML extraction with the released packages contains no new keys for the
      structural regression matrix.

## Human verification checklist (judgment calls)

- [ ] The positive copy set covers the host attributes users and assistive
      technology actually read.
- [ ] The copy set is conservative enough that unknown platform and library
      attributes remain safe by default.
- [ ] The documentation makes the supported boundary predictable rather than
      implying all unknown attributes are translated.
- [ ] The release notes accurately describe the beta.8 safety defect and the
      fixed behavior.
