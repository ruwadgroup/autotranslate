---
id: 007
title: Detect conventional industry copy fields
slug: 007-detect-industry-copy-fields
status: go
tags: [area:core, area:cli, type:fix, auto-mode]
priority: P0
severity: high
effort: XS
risk:
  Generic grammatical field names can classify non-rendered configuration as
  copy.
planned_at:
  { commit: 9b6f0197b622065fad0f28d3a40f0d6a6dbfcfeb, date: 2026-07-18 }
depends_on: [004]
mockups:
  interface: null
  architecture: null
research: null
---

# Spec 007: Detect conventional industry copy fields

## Problem

Applications often centralize industry-specific nouns and calls to action in
typed copy packs. NexAML renders fields named `singular`, `plural`, `verb`, and
`createCta`, but auto mode neither extracts those static values nor recognizes
the dynamic member expressions. This leaves controls such as “Add a customer” in
English even after JSX composition traversal is fixed.

## Instructions

1. Add the exact names `singular`, `plural`, `verb`, `cta`, and `createCta` to
   the shared copy-bearing classifier.
2. Recognize conventional names ending in `Cta` or `CTA`.
3. Bump the classifier version and add core positive and negative tests.
4. Add CLI transform and extraction regressions using a typed copy-pack shape.
5. Add patch changesets for core, CLI, and ESLint plugin.
6. Run the full verification suite, publish through Trusted Publishing, and
   prove NexAML extracts “Add a customer.”

## STOP conditions

- Structural fields such as `value`, `id`, `name`, or `type` become
  copy-bearing.
- Runtime values are translated without an exact catalog entry.

## AI verification checklist

- [ ] Core classifier tests pass.
- [ ] CLI transform and extraction tests pass.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm packages:check` passes.
- [ ] NexAML catalogs contain “Add a customer” with an Arabic translation.
