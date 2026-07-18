---
id: 006
title: Ignore object fields nested in JSX styling props
slug: 006-ignore-jsx-styling-prop-fields
status: done
tags: [area:cli, area:extractor, type:fix, auto-mode]
priority: P0
severity: high
effort: XS
risk: An overly broad styling-prop list can suppress real component copy.
planned_at:
  { commit: cabaa873ff1842a471e9599a808891590e229bbd, date: 2026-07-18 }
depends_on: [005]
mockups:
  interface: null
  architecture: null
research: null
---

# Spec 006: Ignore object fields nested in JSX styling props

## Problem

Auto extraction correctly ignores semantic slot names inside imported styling
factories, but the same structural objects can be passed through JSX styling
props. NexAML uses `<Card classNames={{ header: "px-5 pt-5 pb-3" }}>`. The
nested `header` field is currently extracted as interface copy even though it
only configures CSS classes.

## Instructions

1. Skip semantic object-property extraction when an ancestor JSX attribute is
   named `className`, `classNames`, `classes`, or `styles`.
2. Match the explicit prop name, not the string contents.
3. Preserve ordinary column `header` extraction and ordinary copy props.
4. Add direct and nested regression cases.
5. Add a CLI patch changeset and run the full repository verification suite.
6. Publish through Trusted Publishing and prove the NexAML CSS value is absent
   after extraction.

## STOP conditions

- Ordinary `header`, `title`, or `description` configuration stops extracting.
- The implementation guesses from Tailwind-like string syntax.

## AI verification checklist

- [ ] Focused extractor tests pass.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm packages:check` passes.
- [ ] NexAML catalogs contain no `px-5 pt-5 pb-3` entry.
