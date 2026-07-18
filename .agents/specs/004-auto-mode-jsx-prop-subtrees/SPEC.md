---
id: 004
title: Detect composed JSX and semantic headers in auto mode
slug: 004-auto-mode-jsx-prop-subtrees
status: done
tags: [area:cli, area:compiler, area:core, type:fix, auto-mode]
priority: P0
severity: high
effort: S
risk:
  Traversing JSX-valued props twice can generate duplicate wrappers or corrupt
  insertion ordering.
planned_at:
  { commit: a6516c24ffb568e7b71a98c20f163fee576d35e9, date: 2026-07-18 }
depends_on: []
mockups:
  interface: null
  architecture: null
research: null
---

# Spec 004: Detect composed JSX and semantic headers in auto mode

> **Executor instructions**: This spec is portable. Follow it top to bottom and
> run every AI verification command.

## Problem

`transformAutoWrap()` walks JSX children and JSX nested inside child expression
containers, but it does not walk JSX embedded in a JSX attribute value or spread
expression. This leaves common composition APIs untranslated.

A real NexAML action bar passes buttons through
`<ListPage actions={<div>...</div>}>`. Its buttons contain icon components
followed by static text, such as `<Button><Download /> Export</Button>`. Auto
mode leaves `Export`, `Queue`, `Duplicates`, and `Import` byte-identical, and
extraction records no occurrences for those sites. Production therefore renders
the English labels in Arabic mode.

The same page defines rendered table column labels through static `header`
fields. The shared classifier recognizes `heading` but not the conventional
`header` name, so those labels are neither extracted nor recognized when
rendered from dynamic header expressions.

The compiler already has `collectTopLevelJSX()` for JSX-bearing expressions and
already knows how to wrap icon-plus-text runs. The missing behavior is traversal
from JSX opening-element attributes into those expression subtrees.

## Mockups

- **Interface**: `null` because this is compiler traversal behavior.
- **Architecture**: `null` because the existing walker and runtime tree contract
  remain unchanged.

## Context (self-contained)

The repository is a pnpm and Turborepo TypeScript monorepo.
`packages/cli/src/auto-transform.ts:178-184` recurses into JSX found inside
child expression containers. `packages/cli/src/auto-transform.ts:413-431`
provides `collectTopLevelJSX()`. `walk()` at
`packages/cli/src/auto-transform.ts:185-222` only inspects `node.children`. The
Babel root visitor skips every JSX element that has any JSX ancestor, so JSX
passed through an outer element's attribute is never visited separately.

The safe host-attribute classifier from spec 003 is already published and its
host-attribute rules must not change. This fix affects JSX subtrees inside
attribute expressions and semantic copy-bearing field names, not host attribute
string classification.

## Non-goals

- Translating arbitrary non-JSX object properties without a recognized semantic
  copy-bearing name.
- Changing custom-component prop extraction.
- Changing host-attribute classification.
- Traversing JSX inside code that is not reachable from a JSX root.

## Instructions

1. Extend `walk()` so every JSX element visits top-level JSX found in each
   `JSXAttribute` expression container and each `JSXSpreadAttribute` argument.
2. Reuse `collectTopLevelJSX()` and the existing walker. Do not create a second
   wrapping algorithm.
3. Guarantee each JSX subtree is visited exactly once. Preserve current output
   byte-for-byte for files without JSX-valued props.
4. Add transform tests for a JSX-valued `actions` prop containing nested custom
   components, an icon-plus-text button, a dynamic copy-bearing child, and a
   `data-no-translate` subtree.
5. Add an extraction regression proving the nested action copy appears in the
   source catalog with the occurrence line from the consumer file.
6. Add `header` and names ending in `Header` to the shared copy-bearing name
   classifier, bump its classifier version, and cover both accepted and rejected
   names in core tests.
7. Add extraction coverage for a static table column `header` field and dynamic
   transform coverage for a rendered `{header}` expression.
8. Add patch changesets for `@autotranslate/cli`, `@autotranslate/core`, and
   `@autotranslate/eslint-plugin`.
9. Run all verification commands, commit, push, version through Changesets,
   publish with Trusted Publishing, and verify the npm beta tag.
10. Re-run NexAML extraction against the release and prove customer action
    labels have customer-page occurrences.

## STOP conditions

- The same subtree receives duplicate `<T>` wrappers.
- Traversal changes existing output for JSX that is not inside an attribute or
  spread expression.
- Attribute-expression traversal requires evaluating JavaScript or following
  identifiers across files.
- NexAML still has no catalog occurrences for the action labels after installing
  the release.

## AI verification checklist (automatable)

- [ ] `pnpm --filter @autotranslate/cli exec vitest run src/auto-transform.test.ts src/commands/extract/extractor.test.ts`
      passes.
- [ ] `pnpm typecheck` reports zero errors.
- [ ] `pnpm lint` is clean.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` succeeds.
- [ ] `pnpm packages:check` succeeds.
- [ ] A CLI patch changeset exists.
- [ ] Core classifier tests prove `header` and suffix `Header` names are copy.
- [ ] Extraction records static table `header` fields.
- [ ] NexAML extraction records customer-page occurrences for `Export`, `Queue`,
      `Duplicates`, and `Import`.

## Human verification checklist (judgment calls)

- [ ] Icon-plus-text controls remain visually and semantically intact after
      translation.
- [ ] Translation can reorder text and inline icon tags without losing the icon.
- [ ] Nested composition APIs behave like ordinary JSX children in auto mode.
