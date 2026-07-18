---
id: 011
title: Preserve optional forwarded copy in auto mode
slug: 011-null-safe-forwarded-copy
status: done
tags: [area:cli, type:fix, auto-mode]
priority: P0
severity: critical
effort: XS
risk:
  The generated guard must preserve non-string values and evaluate forwarded
  expressions exactly once.
planned_at: { commit: efaa206, date: 2026-07-18 }
depends_on: [009]
mockups:
  interface: null
  architecture: null
research: null
---

# Spec 011: Preserve optional forwarded copy in auto mode

## Problem

Auto mode wraps copy-bearing identifier and member expressions with `t(...)`.
Optional props can be `undefined`, so generated code such as
`t(filterSearchPlaceholder)` crashes when the translator reads the key.

NexAML reproduced this in production through its shared data-table toolbar.

## Instructions

1. Evaluate forwarded dynamic attribute expressions exactly once.
2. Translate the value only when it is a string.
3. Preserve `undefined`, `null`, and other non-string values unchanged.
4. Keep static attribute output unchanged.
5. Add compiler regressions, run the complete verification suite, publish
   through Trusted Publishing, and verify NexAML production.

## STOP conditions

- A forwarded expression is evaluated more than once.
- Non-string values are passed to `t` or changed by the transform.
- Static attribute output changes.

## AI verification checklist

- [x] Null-safe forwarded-copy regressions pass.
- [x] Static attribute regressions pass.
- [x] `pnpm typecheck` passes.
- [x] `pnpm lint` passes.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] `pnpm packages:check` passes.
- [x] NexAML production customer register renders without an error boundary.
