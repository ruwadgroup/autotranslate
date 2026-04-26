---
'@autotranslate/react': minor
---

Initial implementation of `@autotranslate/react`:

- `<T>` JSX component that walks children, derives a canonical message tree,
  hashes it to a key, looks up the translation in the active catalog, and
  renders the translated tree using the original `<Var>` / `<Plural>` / HTML
  elements as templates so props and event handlers carry over.
- `<Var name?>{value}</Var>` variable slot marker (default name `value`).
- `<Plural value name? zero? one? two? few? many? other />` plural marker with
  CLDR category selection via `Intl.PluralRules` and `#` substitution.
- `<TranslationProvider locale catalog? fallback? />` — locale + catalog
  context. Missing provider degrades gracefully to source rendering.
- `useT()` — hook returning `(key, params?) => string` for plain-string
  translation (labels, `aria-*`, etc.).
- `useLocale()` — hook returning the active locale.
- `@autotranslate/react/server` subpath with
  `getT(locale, loadCatalog, loadFallback?)` async factory and a re-exported
  `createTranslator` for RSC / SSR / route handlers / edge runtimes. The
  `react-server` export condition is wired so RSC bundlers pick this entry
  automatically.
