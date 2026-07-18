---
id: 002
title: Auto-mode attribute translation (placeholder, title, aria-label, …)
slug: 002-auto-attribute-translation
status: ready
tags: [area:cli, area:compiler, area:eslint, type:feat, auto-mode]
priority: P1
severity: medium
effort: L
risk:
  useT() injection into component scope mis-fires (hook-rules violations) or
  over-wraps custom-component props
planned_at: { commit: 95bc981, date: 2026-07-18 }
depends_on: []
mockups:
  interface: null
  architecture: arch.md
research: null
---

# Spec 002: Auto-mode attribute translation

> **Executor instructions**: This spec is portable - everything you need is in
> this file and `arch.md`. Follow it top to bottom. Run every command in the AI
> verification checklist and confirm the expected result before reporting done.
> If a STOP condition fires, stop and report - do not improvise.

## Problem

`mode: 'auto'` auto-wraps JSX **text** in `<T>` but ignores copy-bearing
**attributes** on host/DOM elements - `placeholder`, `title`, `aria-label`, and
any other non-allowlisted string attribute. These render their literal to the
DOM untranslated, so an "auto" app still ships thousands of untranslated strings
(a real consumer, nexaml, has ~1,500 such attribute literals).
`no-untranslated-jsx` flags them but there is no compiler support, forcing
manual `useT()` wrapping at every site. This is the ROADMAP item **"Attribute
auto-wrapping (`placeholder`, `aria-label`, …)"**. This spec implements it.

The end state: in a `"use client"` file, `mode: 'auto'` rewrites
`placeholder="Search cases"` to `placeholder={t("Search cases")}` and ensures a
`useT()` binding exists - so attributes are translated with zero manual work,
extraction stays consistent by construction, and the lint rule stops flagging
what the compiler now handles.

## Mockups

- **Interface** - `null`. This is a compiler/tooling feature with no UI surface.
- **Architecture** - `arch.md`: before→after transform examples, the client-only
  boundary and its rationale, the qualification rules, and the four-surface
  lockstep (classifier → transform → extractor → lint).

## Context (self-contained)

**Repo**: pnpm + turbo monorepo, TypeScript strict, Vitest, Biome. Verification
(from repo root): `pnpm typecheck` (turbo → tsc per package), `pnpm test` (turbo
→ vitest), `pnpm lint` (`biome check .`), `pnpm build` (turbo). Targeted tests:
`pnpm --filter @autotranslate/cli exec vitest run <file>`.

**The transform** - `packages/cli/src/auto-transform.ts`,
`transformAutoWrap(source, {filename})`. Splice-based: it inserts wrapper tags
around existing node ranges and never regenerates from the AST (output
byte-identical except inserts). Text runs → `<T>`, dynamic `{expr}` → `<Var>`.
`planImportEdit(ast, usedVar)` decides how to add `T`/`Var` from
`@autotranslate/react` (merge into an existing import, or a new statement after
directives), returning an `Insertion`, `null`, or `'conflict'` (a name is taken
by an unrelated binding → warn and skip the whole file). Import module constant:
`REACT_MODULE = '@autotranslate/react'`.

**The classifier** - `packages/core/src/classifier.ts`. Exports
`isAllowlistedAttribute(name)` (35-entry set + `data-*`), `isCopyBearingName`,
`jsxTextHasContent`, `TRANSLATION_MARKERS`, `SKIP_ELEMENTS`,
`NO_TRANSLATE_ATTRIBUTE`, `CLASSIFIER_VERSION` (currently `2`). Both the
compiler and the ESLint plugin import from here - "what the linter flags is
exactly what `mode: 'auto'` would wrap."

**The extractor** - `packages/cli/src/commands/extract/index.ts:31` already does
`if (config.mode === 'auto') source = transformAutoWrap(source, {filename}).code;`
then `extractFile(..., { includeAutoCopy: config.mode === 'auto' })`.
`extractFile` (`.../extract/extractor.ts`) tracks `const t = useT()` bindings
(the `VariableDeclarator` visitor checks `init.callee.name === 'useT'`) and
extracts `t('literal')` calls via the `CallExpression` visitor using
`sourceKey(literal, context)`. So **an injected `t("…")` is extracted with no
extractor change**. Separately, `includeAutoCopy` extracts copy props on
**custom** components only (`isCustomJSXName` = uppercase) and copy-bearing
object properties / variable declarators - that path is unrelated to
host-element attributes and must stay intact.

**The lint rule** - `packages/eslint-plugin/src/rules/no-untranslated-jsx.ts`.
Emits `bareText`, `bareAttribute`, `dynamicCopy`. It reports `bareAttribute` for
non-allowlisted string-literal attributes. **Verify during execution** how (or
whether) it currently suppresses `bareText` in auto mode - the rule as written
reports `bareText` unconditionally, so "the rule won't fire in auto mode" may be
a pipeline effect (linting post-transform) rather than a rule option. Align
attribute suppression with whatever text does; if there is no auto-mode
awareness today, add a rule option (e.g. `mode: 'auto'` / `autoHandled: true`)
that suppresses the cases the compiler now handles, and document it. Do **not**
regress existing rule behavior.

**Runtime** - `@autotranslate/react` is `'use client'`
(`packages/react/src/index.tsx:1`); `useT()` (`use-t.ts`) is a client hook
reading context. This is why the feature is client-only (see `arch.md`).

## Non-goals

- Server-component attributes - no clean automatic path; lint keeps warning.
- Custom-component copy props (`<Field placeholder=…>`) - existing
  `includeAutoCopy` behavior stays unchanged; the transform must **not** inject
  `t()` there.
- Dynamic attribute values (`title={expr}`, template literals with expressions).
- Programmatic non-JSX strings (`toast.success("…")`, `throw new Error("…")`).
- Any change to text wrapping, `<Var>`, or existing `<T>` behavior.

## Instructions

Ordered. Units 1-2 are foundational; 3 is the bulk; 4-5 depend on 3; 6 is docs.

1. **Classifier** (`packages/core/src/classifier.ts`). Add and export
   `isTranslatableAttribute(name: string): boolean` =
   `!isAllowlistedAttribute(name)`. (Value-shape checks - static string with
   visible content - live in the transform/rule via existing helpers.) Bump
   `CLASSIFIER_VERSION` to `3`. Add a classifier unit test.

2. **Transform helpers** (`packages/cli/src/auto-transform.ts`). Add pure
   helpers: detect a host element (lowercase `JSXIdentifier` opening name); read
   a static string attribute value with visible content (reuse
   `staticStringValue` + `jsxTextHasContent`); given a component/hook function
   node, find an existing `useT()` binding name in its body, else compute the
   injection.

3. **Transform: attribute rewrite + `useT` binding** (`auto-transform.ts`). In a
   file that is a **client module** (has a top-level `"use client"` /
   `'use client'` directive) only:
   - Walk JSX opening elements. For each host element not blocked
     (`isBlockingElement`, `data-no-translate` on self/ancestor), for each
     `JSXAttribute` whose name passes `isTranslatableAttribute` and whose value
     is a static string with visible content: splice the value `"Str"` →
     `{<binding>("Str")}` (insert `{<binding>(` before the string literal and
     `)}` after it, preserving the quotes).
   - `<binding>` resolution per enclosing component/hook function (nearest
     ancestor function whose name matches `/^[A-Z]/` or `/^use[A-Z]/`, walking
     out through nested closures): reuse an existing `const x = useT()` in that
     function; else pick `t` (or `__t` on conflict) and record that this
     function needs a `const <binding> = useT();` injected at the top of its
     body (after any leading directives), once.
   - No enclosing component/hook function, or an irresolvable name conflict →
     **skip** that attribute (leave the literal); on conflict emit the same
     style of `console.warn` the file-level `T`/`Var` conflict uses.
   - Extend the import machinery so `useT` is added to the
     `@autotranslate/react` import when any injection happened (generalize/reuse
     `planImportEdit`; it currently handles `T`/`Var` - add `useT`). Preserve
     its merge/new-statement/ directive-aware placement and `'conflict'`
     semantics.
   - Injection is the only non-splice edit; keep everything else byte-identical.
     Update the module doc comment to describe attribute handling.

4. **Extractor** (`packages/cli/src/commands/extract/`). No logic change
   expected. Add a regression test: an auto-mode extract over
   `<input placeholder="Search cases" />` in a `"use client"` file yields the
   same source key as hand-written `t("Search cases")`, and does **not**
   double-extract via `includeAutoCopy`. If a change is unavoidable, keep the
   custom-component `includeAutoCopy` path intact and explain why.

5. **Lint rule** (`no-untranslated-jsx`). Suppress `bareAttribute` for cases the
   compiler now handles (host element in an auto-mode client file), aligned with
   the text mechanism (see Context). Keep `bareAttribute` for server-component /
   custom-component / disallowed cases and keep `dynamicCopy`/`bareText`
   unchanged. Update the rule's tests and its README/option docs.

6. **Docs**. Update: `docs/reference/configuration.md#mode` (auto mode now
   covers host-element attributes, client-only), `docs/guides/strings.md` or
   `docs/guides/jsx.md` (attribute behavior + `data-no-translate` opt-out),
   `docs/guides/linting.md` (`no-untranslated-jsx` in auto mode for attributes),
   `ARCHITECTURE.md` "Auto mode" section, and `ROADMAP.md` (mark/move the
   attribute-auto-wrapping item). Add a changeset (`pnpm changeset`) - minor
   bump for `@autotranslate/core`, `@autotranslate/cli`,
   `@autotranslate/eslint-plugin`.

## STOP conditions

- Cited files drift from the excerpts above (`git diff --stat` since `95bc981`).
- The `useT` injection cannot be made hook-safe for a common pattern (e.g. JSX
  returned from a non-component nested function with no enclosing
  component/hook) without risking a hook-rules violation - stop and report the
  pattern; prefer skipping (leave literal + lint) over emitting unsafe code.
- Making the lint rule auto-mode-aware would require it to read the
  autotranslate config in a way the plugin architecture does not support - stop
  and report; propose the rule-option fallback.
- Any change would alter existing `<T>`/`<Var>` text-wrapping output (verify the
  full existing `auto-transform.test.ts` still passes byte-for-byte).
- The custom-component `includeAutoCopy` extraction changes behavior.

## AI verification checklist (automatable)

- [ ] `pnpm --filter @autotranslate/cli exec vitest run src/auto-transform.test.ts` -
      pass, including new cases: host attr rewrite; `useT` injected; existing
      `useT` binding reused; import merged vs new statement; injection placed
      after directives; **server-component (no "use client") file left
      unchanged**; custom-component prop **not** injected; nested-closure list
      references component-scope binding; `data-no-translate` opt-out;
      allowlisted attrs (`className`, `href`, `alt`, `data-*`) untouched;
      dynamic/template values untouched; name-conflict warn-and-skip; and every
      pre-existing text-wrapping assertion still holds byte-for-byte.
- [ ] `pnpm --filter @autotranslate/cli exec vitest run src/commands/extract/extractor.test.ts` -
      pass, including the injected-`t()` ↔ hand-written-`useT` key-parity test.
- [ ] `pnpm --filter @autotranslate/eslint-plugin test` (or vitest path) - pass,
      including auto-mode attribute suppression + preserved warnings.
- [ ] Classifier test for `isTranslatableAttribute` (allowlist in/out,
      `data-*`).
- [ ] `pnpm typecheck` - 0 errors across packages.
- [ ] `pnpm lint` - clean (Biome).
- [ ] `pnpm test` - full suite green.
- [ ] `pnpm build` - all packages build.
- [ ] A changeset file exists under `.changeset/`.

## Human verification checklist (judgment calls)

- [ ] The client-only boundary is the right call (vs a universal cloneElement
      wrapper that also covers server components but hoists keys in lists) - see
      `arch.md`. Confirm the trade-off.
- [ ] Generated output reads like hand-written code (`placeholder={t("…")}`, one
      `const t = useT()` per component) and is debuggable.
- [ ] `useT` injection never produces a hook-rules violation in the real
      consumer (build + run nexaml `apps/web` with `mode:'auto'` after this
      lands; the ~1,500 attribute sites translate and the app renders in Arabic
      RTL).
- [ ] No surprising over-wrapping (e.g. `type`, `name`, `href`, `data-*`, SVG
      geometry attrs stay literal).
- [ ] Docs read correctly and the ROADMAP reflects the shipped state.
