---
id: 008
title: Translate rendered branch strings and custom-component accessibility copy
slug: 008-render-expression-and-custom-attribute-copy
status: done
tags: [area:cli, type:fix, auto-mode, accessibility]
priority: P0
severity: high
effort: S
risk:
  Render-expression traversal can classify strings that control logic instead of
  strings that reach the DOM.
planned_at:
  { commit: a3ab709e40d0e996bcef80a8ea73d0f8a9abccec, date: 2026-07-18 }
depends_on: [004]
mockups:
  interface: null
  architecture: null
research: null
---

# Spec 008: Translate rendered branch strings and custom-component accessibility copy

## Problem

Auto mode treats a conditional expression that is the sole child of a JSX
element as opaque runtime data. Consequently, expressions such as
`{dependent ? "Related party" : "Direct customer"}` render English even though
both terminal strings are static interface copy.

Auto mode also rewrites copy-bearing accessibility attributes only on lowercase
host elements. Shared trigger components frequently forward attributes such as
`aria-label="Row actions"` to a host button, so limiting translation to the call
site's tag casing leaves accessibility copy untranslated.

The NexAML Arabic customer register reproduces both failures in production.

## Instructions

1. Add an end-to-end transform and extraction regression for static string
   branches in a JSX conditional expression.
2. Translate only terminal string values that are provably rendered by a
   conditional expression, including nested conditionals and transparent
   TypeScript wrappers.
3. Preserve dynamic expressions, identifiers, non-rendered call arguments, and
   structural values unchanged.
4. Rewrite positive accessibility-copy attributes on custom JSX components in
   client modules when semantic copy propagation does not already own the prop,
   while preserving the existing skip, `data-no-translate`, and catalog-key
   behavior.
5. Add transform and extraction regressions for a custom trigger with an
   `aria-label`.
6. Add a patch changeset for CLI and run the full verification suite.
7. Publish through Trusted Publishing and prove NexAML extracts and translates
   `Direct customer`, `Related party`, and `Row actions`.

## STOP conditions

- A string outside a JSX render branch or the positive attribute set is
  translated.
- Conditional operands or discriminants are rewritten.
- Server components gain a client-only hook.
- A `data-no-translate` subtree is modified.

## AI verification checklist

- [x] CLI transform tests cover flat and nested conditional string branches.
- [x] CLI transform tests cover custom-component accessibility attributes.
- [x] Extraction tests contain every terminal source string.
- [x] `pnpm typecheck` passes.
- [x] `pnpm lint` passes.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] `pnpm packages:check` passes.
- [x] NexAML catalogs contain Arabic for the three production reproductions.
