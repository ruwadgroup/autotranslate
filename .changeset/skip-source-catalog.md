---
'@autotranslate/cli': patch
'@autotranslate/core': patch
'@autotranslate/react': patch
---

Stop shipping the source-locale catalog. Rendering the source locale never reads
it - `<T>` falls back to its own children and `t()` to its own key, both of
which are the source text already inlined in the component - so the entries were
only ever the app sending its own copy back to itself.

The generated `loadCatalog` now returns an empty catalog for the source locale.
In a server-rendered app the effect is large and immediate: the provider takes
the catalog as a client prop, so it was serialised into the RSC payload of every
navigation. On a mid-sized Next app this was ~960KB per page - the same English
strings twice, once as `catalog` and once as `fallback`.

Two supporting changes make that safe rather than merely smaller:

- `createTranslator` and `TranslationProvider` accept `source`. When it equals
  the active locale a lookup miss is the expected outcome, so the miss is no
  longer recorded or warned about; without this, an empty source catalog would
  report every string on the page as a missing translation.
- `TranslationProvider` drops `fallback` when it is the same object as
  `catalog`, which is the common wiring for the source locale and cost a second
  full serialisation of the same data.
