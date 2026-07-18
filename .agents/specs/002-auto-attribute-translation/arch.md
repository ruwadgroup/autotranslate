# Architecture - auto-mode attribute translation

## The gap

`mode: 'auto'` today wraps JSX **text** in `<T>` via `transformAutoWrap`. It
does **nothing** for copy-bearing **attributes** on host/DOM elements, which
render their literal to the DOM untranslated:

```tsx
<input placeholder="Search cases" aria-label="Search" />
<button title="Delete customer">✕</button>
```

`no-untranslated-jsx` flags these (`bareAttribute`) but there is no compiler
support, so users must hand-wrap every one with `useT()`. In a real app that is
1000s of sites (nexaml: ~1,500 attribute literals). This spec makes auto mode
handle them.

## Why attributes are different from text (and why this is client-only)

`<T>` is a component - it works inside a server component as a client island
under `<TranslationProvider>`. An **attribute needs a string**, so it needs
`t("…")` from `useT()`. `@autotranslate/react` is `'use client'`, so `useT()` is
a client hook and cannot run in a server component. `getT` is async and needs
locale + catalog module in scope - not something we can inject into an arbitrary
attribute position safely.

**Decision:** attribute auto-translation is a **client-component** feature. In a
file with a `"use client"` directive the transform rewrites copy attributes and
injects `useT()`. In server-component files it does nothing and the lint rule
keeps warning (the honest, visible boundary). Text `<T>` wrapping is unchanged
and stays universal.

## Transform: before → after

Host element, client file:

```tsx
// BEFORE
'use client';
export function SearchBar() {
  return <input placeholder="Search cases" aria-label="Search" />;
}

// AFTER  (transformAutoWrap, mode: 'auto')
('use client');
import { useT } from '@autotranslate/react';
export function SearchBar() {
  const t = useT();
  return <input placeholder={t('Search cases')} aria-label={t('Search')} />;
}
```

Reuse an existing `useT()` binding instead of injecting a second one:

```tsx
// BEFORE
'use client';
import { useT } from '@autotranslate/react';
export function Row({ n }) {
  const tr = useT();
  return (
    <button title="Delete" aria-label={`Delete ${n}`}>
      {tr('X')}
    </button>
  );
}
// AFTER  — `title` uses the existing `tr`; the template attr is left alone (dynamic)
return (
  <button title={tr('Delete')} aria-label={`Delete ${n}`}>
    {tr('X')}
  </button>
);
```

Nested closure (list): inject once at the component scope, reference lexically:

```tsx
// BEFORE
'use client';
export function List({ items }) {
  return items.map((it) => <input key={it.id} placeholder="Filter" />);
}
// AFTER
import { useT } from '@autotranslate/react';
export function List({ items }) {
  const t = useT();
  return items.map((it) => <input key={it.id} placeholder={t('Filter')} />);
}
```

## What qualifies (shared classifier)

An attribute is translated when **all** hold:

- value is a **static string literal** (or single-quasi template) with visible
  letter content (`jsxTextHasContent`);
- name is **not allowlisted** (`isAllowlistedAttribute`: `className`, `id`,
  `href`, `src`, `alt`, `type`, `data-*`, …);
- element is a **host element** (lowercase tag) - custom components
  (`<Field placeholder=…>`) keep the existing `includeAutoCopy` path untouched
  (the component translates its own prop);
- element is not a skip element (`code/pre/script/style`), not a marker, not
  under `data-no-translate`.

New classifier export `isTranslatableAttribute(name)` =
`!isAllowlistedAttribute(name)`, shared by the transform and the lint rule so
they never disagree. `CLASSIFIER_VERSION` bumps.

## Four surfaces stay in lockstep

```mermaid
flowchart LR
  cls["core/classifier.ts<br/>isTranslatableAttribute()<br/>+ static-string value check"]
  cls --> tf["cli/auto-transform.ts<br/>rewrite attr → {t(\"…\")}<br/>+ inject/reuse useT()"]
  cls --> lint["eslint-plugin/no-untranslated-jsx<br/>suppress compiler-handled<br/>attrs in auto mode"]
  tf --> ex["cli/extract (auto mode)<br/>pipes through transformAutoWrap<br/>→ t(\"…\") extracted for free"]
```

- **transform** (`packages/cli/src/auto-transform.ts`): the new rewrite + `useT`
  binding management (inject / reuse / lexical-capture / conflict-skip), reusing
  the existing `planImportEdit` machinery extended for `useT`.
- **extractor** (`packages/cli/src/commands/extract/index.ts:31`): already runs
  `transformAutoWrap` before extraction, so injected `t("…")` calls are picked
  up by the existing `useT` call-site path. **No extractor logic change** - just
  a regression test proving keys match.
- **lint rule** (`no-untranslated-jsx`): stop emitting `bareAttribute` for cases
  the compiler now handles (host element + auto mode), aligned with how text is
  handled; keep warning for server-component / custom-component / disallowed
  cases.
- **classifier**: the single source of truth both import.

## Binding-injection safety (transform)

- Reuse the first in-scope `const x = useT()`; else inject `const t = useT()` at
  the top of the nearest enclosing **component/hook** function (`/^[A-Z]/` or
  `/^use[A-Z]/`). Attributes in nested closures reference the component-scope
  binding.
- No enclosing component/hook function, or an unresolved name conflict →
  **skip** that attribute (leave the literal + a lint warning); mirror the
  existing `T`/`Var` `'conflict'` warn-and-skip.
- Injection is the one place the transform adds a statement rather than pure
  splicing; everything else stays byte-identical.

## Out of scope

- Server-component attributes (no clean automatic path; lint keeps warning).
- Custom-component copy props (existing `includeAutoCopy` behavior unchanged).
- Programmatic strings (`toast.success("…")`, thrown errors) - not JSX; a
  separate concern, tracked but not here.
- Dynamic attribute values (`title={foo}`, template literals with expressions) -
  left as-is; `<Var>`-style attribute interpolation is future work.
