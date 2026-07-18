---
id: 005
title: Ignore styling configuration fields during auto extraction
slug: 005-ignore-styling-config-copy-fields
status: done
tags: [area:cli, area:extractor, type:fix, auto-mode]
priority: P0
severity: high
effort: S
risk:
  Styling-factory detection that relies only on local identifier spelling can
  miss aliases or suppress unrelated calls.
planned_at:
  { commit: 97c9c393341e5a9e6d9f05507730abf577ab1c28, date: 2026-07-18 }
depends_on: [004]
mockups:
  interface: null
  architecture: null
research: null
---

# Spec 005: Ignore styling configuration fields during auto extraction

> **Executor instructions**: This spec is portable. Follow it top to bottom and
> run every AI verification command.

## Problem

Auto extraction recognizes semantic object-property names such as `title`,
`description`, and `header` as interface copy. Styling libraries use the same
names for component slots. For example,
`tv({ slots: { header: "flex px-6", title: "text-sm" } })` currently adds
Tailwind class lists to translation catalogs even though those values are never
rendered as text.

The NexAML consumer audit found seven newly missing Arabic entries that were
structural styling values. Translating them would corrupt class names if they
were ever passed through the runtime and pollute catalogs regardless.

## Context

`packages/cli/src/commands/extract/extractor.ts` visits every `ObjectProperty`
with a shared copy-bearing name. The visitor can inspect Babel bindings to
determine whether an ancestor call resolves to an import from a known styling
configuration package. The consumer uses `tv` from `tailwind-variants`. The
ecosystem also commonly uses `cva` from `class-variance-authority`.

## Non-goals

- Guessing whether arbitrary strings resemble Tailwind utilities.
- Suppressing semantic fields in ordinary application configuration objects.
- Changing runtime JSX traversal or host-attribute classification.
- Supporting styling factories that are not statically imported.

## Instructions

1. Track or resolve bindings imported from `tailwind-variants` and
   `class-variance-authority` without relying on the local alias spelling.
2. Before recording a semantic `ObjectProperty`, detect whether it is nested
   anywhere inside a call to one of those imported styling factories.
3. Skip only object-property auto-copy extraction in those calls.
4. Preserve JSX text and explicit translation markers that happen to appear in
   nearby code.
5. Add extractor regressions for direct imports and aliased imports from both
   supported packages.
6. Prove an ordinary `{ header: "Relationship" }` column definition still
   extracts.
7. Add a CLI patch changeset, run all repository checks, publish through Trusted
   Publishing, and verify NexAML extraction no longer includes styling values.

## STOP conditions

- Real table headers or ordinary configuration labels disappear.
- Detection depends on the names `tv` or `cva` rather than their import
  bindings.
- A heuristic suppresses arbitrary strings merely because they contain spaces or
  hyphens.

## AI verification checklist

- [ ] Focused extractor tests pass.
- [ ] Direct and aliased imports for both styling packages are covered.
- [ ] Ordinary semantic configuration fields remain extracted.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` passes.
- [ ] `pnpm packages:check` passes.
- [ ] NexAML extraction has no catalog entries for the identified Tailwind slot
      values.

## Human verification checklist

- [ ] Catalog entries correspond to copy a user can actually see or hear.
- [ ] Styling slot configuration remains byte-identical at build time.
