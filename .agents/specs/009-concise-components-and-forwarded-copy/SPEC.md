---
id: 009
title: Translate concise components and forwarded dynamic copy
slug: 009-concise-components-and-forwarded-copy
status: done
tags: [area:cli, type:fix, auto-mode, accessibility]
priority: P0
severity: high
effort: S
risk:
  Rewriting concise component bodies can change expression return semantics or
  translate dynamic values that are data rather than interface copy.
planned_at: { commit: 15afa2d, date: 2026-07-18 }
depends_on: [008]
mockups:
  interface: null
  architecture: null
research: null
---

# Spec 009: Translate concise components and forwarded dynamic copy

## Problem

Auto mode cannot inject `useT()` when a named React component uses a concise
arrow body. As a result, static accessibility copy such as
`aria-label="Toggle columns"` remains English.

Auto mode also leaves a copy-bearing expression forwarded through a component
attribute untranslated. For example, `placeholder={resolvedSearchPlaceholder}`
reaches a native input as English even when the exact rendered string exists in
the catalog.

The NexAML Arabic customer register reproduces both failures in production.

## Instructions

1. Add transform regressions for a named concise arrow component with a static
   accessibility attribute.
2. Convert only named React component or hook concise arrow bodies into block
   bodies when translation hook injection is required.
3. Preserve the original expression as the returned value and leave anonymous
   callbacks unchanged.
4. Translate identifier and member-expression attribute values only when their
   semantic name is copy-bearing.
5. Preserve the existing custom-component literal key behavior and every skip
   boundary.
6. Run the complete verification suite and publish through Trusted Publishing.
7. Prove NexAML renders Arabic for `Toggle columns` and `Search customers...`.

## STOP conditions

- An anonymous callback or non-component arrow is converted.
- A dynamic value without a copy-bearing semantic name is translated.
- A server component gains a client-only hook.
- Existing static custom-component catalog keys change.

## AI verification checklist

- [x] Concise component transform tests pass.
- [x] Forwarded dynamic attribute transform tests pass.
- [x] Static custom-component key preservation tests pass.
- [x] `pnpm typecheck` passes.
- [x] `pnpm lint` passes.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] `pnpm packages:check` passes.
- [x] NexAML production renders the two reproductions in Arabic.
