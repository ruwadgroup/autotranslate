---
id: 010
title: Extract display copy from enum factories
slug: 010-enum-factory-copy
status: go
tags: [area:cli, type:fix, auto-mode]
priority: P0
severity: high
effort: XS
risk:
  A factory named createEnum could contain machine tokens instead of display
  copy.
planned_at: { commit: 20a3bca, date: 2026-07-18 }
depends_on: [009]
mockups:
  interface: null
  architecture: null
research: null
---

# Spec 010: Extract display copy from enum factories

## Problem

Auto mode extracts object values only when the property name is semantically
copy-bearing. Display mappings passed to `createEnum({...})` use machine keys
such as `prospect` and `kyc_pending`, so their human-readable values never enter
the catalog.

NexAML renders these values through translated dynamic label paths, but the
Arabic catalog has no matching messages.

## Instructions

1. Extract static string values from the direct object argument of a
   `createEnum` call in auto mode.
2. Preserve the existing behavior for ordinary objects and explicit mode.
3. Do not extract nested configuration objects or dynamic values.
4. Add extractor regressions and run the complete verification suite.
5. Publish through Trusted Publishing and verify the NexAML customer enums in
   Arabic.

## STOP conditions

- Ordinary machine-token object values become catalog copy.
- Dynamic values or nested objects are extracted.
- Explicit mode behavior changes.

## AI verification checklist

- [x] Enum factory extraction tests pass.
- [x] Ordinary object exclusion tests pass.
- [x] `pnpm typecheck` passes.
- [x] `pnpm lint` passes.
- [x] `pnpm test` passes.
- [x] `pnpm build` passes.
- [x] `pnpm packages:check` passes.
- [ ] NexAML production renders customer enum labels in Arabic.
