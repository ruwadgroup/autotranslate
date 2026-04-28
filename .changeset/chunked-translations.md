---
'@autotranslate/cli': minor
'@autotranslate/core': minor
'@autotranslate/next': minor
'@autotranslate/vite': minor
---

Chunked catalog and cache layout

`.translations/` is now a tree, not flat files. The CLI groups keys into chunks
by their alphabetically-first occurrence's source file:

```
.translations/
  en/
    components/Header.json
    pages/Checkout.json
    _external/zod.json
  es/  …
  .cache/<provider-sig>/<source-target>/<chunk>.json
```

Wins:

- **Reviewable diffs.** A 5-string copy change shows up in 1-2 small chunk files
  instead of buried in a multi-thousand-line catalog.
- **Skip-on-no-change.** Each chunk caches its `chunkHash`; runs where
  `chunkHash` matches skip the API entirely. No-op CI passes are now effectively
  free.
- **Better consistency.** Within a chunk, unchanged neighbouring strings ride
  along as context for AI re-translation of changed strings.
- **Auto-split.** Chunks exceeding 300 strings split alphabetically
  (`Foo.0.json`, `Foo.1.json`). Default cap configurable.

Migration: silent, on first `translate` run after upgrade. The flat
`<locale>.json` source file is reshaped into the chunked tree; legacy
`.cache/<sig>.json` files are pruned (cache resets — first run is a cold pass).

`fsCatalogLoader` (Next) and the Vite plugin walk the new tree recursively. Both
retain a fallback to the flat layout for users mid- upgrade — the runtime never
breaks during the transition.

New helpers in `@autotranslate/core/internal`:

- `chunkPathFor(meta)` — pure function returning the chunk path for a key
- `buildChunkLayout(manifest, options?)` — chunk path → keys map
