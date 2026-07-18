---
'@autotranslate/core': minor
'@autotranslate/cli': minor
'@autotranslate/eslint-plugin': minor
---

Auto mode now translates host-element copy attributes. In a `"use client"` file,
`mode: 'auto'` rewrites `<input placeholder="Search cases" />` to
`<input placeholder={t("Search cases")} />` and injects (or reuses) a
`const t = useT()` binding in the enclosing component/hook. Non-copy attributes
(`className`, `href`, `type`, `data-*`, …) and custom-component props are left
alone; `data-no-translate` opts an element out. Because `useT()` is a client
hook, this runs only in client modules — server-component attributes remain lint
warnings.

- `@autotranslate/core`: new `isTranslatableAttribute` classifier export;
  `CLASSIFIER_VERSION` bumped to 3.
- `@autotranslate/cli`: `transformAutoWrap` handles copy attributes; the
  extractor's transform-then-extract path keeps keys identical to hand-written
  `useT()`.
- `@autotranslate/eslint-plugin`: `no-untranslated-jsx` gains an `autoMode`
  option that suppresses the host-element attribute warnings the compiler now
  handles.
