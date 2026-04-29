---
'@autotranslate/core': minor
'@autotranslate/cli': minor
'@autotranslate/react': patch
'@autotranslate/next': patch
'@autotranslate/vite': patch
'@autotranslate/providers': patch
'@autotranslate/eslint-plugin': patch
'@autotranslate/typescript-plugin': patch
'@autotranslate/experiments': patch
'@autotranslate/zod': patch
---

Hash-bucketed catalog layout — flat per locale, deduped by construction

Replaces the source-tree-mirroring chunk layout with a flat hash-bucketed shape.

**Before** (chunked by source path — deeply nested, awkward to grep / diff):

```
.translations/
  en/
    apps/web/src/components/Button.json
    apps/web/src/components/Header.json
    packages/ui/src/Card.json
    ...
```

**After** (16 buckets per locale, name = first hex digit of the key's hash):

```
.translations/
  en/
    0.json   1.json   ...   f.json
  es/
    0.json   1.json   ...   f.json
  .meta.json
```

### What changes for users

- **Catalog keys are 12-char SHA-256 hashes** (`041c03cfcadc`) instead of
  literal source strings. Plain-string `useT('Sign out')` calls hash internally;
  users still write the literal source. `<T>` blocks already used `t.<hash>`
  keys — those persist with the same shape.
- **Same hash → same bucket across every locale.** `en/3.json`, `es/3.json`,
  `fr/3.json` carry the same key set, just with different translated values.
- **Cross-locale alignment is structural.** No drift between locales when keys
  move; the hash is content-addressed.
- **Smaller, finer-grained diffs.** Adding or changing one string touches one
  bucket file per locale.
- **Bundler tree-shaking improves.** Each bucket is an independent JSON import;
  SPAs ship only buckets a route actually touches.

### Auto-migration on read

Runtime loaders (`fsCatalogLoader`, Vite virtual module) and the CLI catalog
reader transparently rekey old literal-keyed catalogs into the new hashed layout
on first read. Existing apps Just Work after upgrade — the next `extract` /
`translate` run reshapes the on-disk files.

### New CLI command

```bash
npx autotranslate migrate-format
```

Forces every locale through the writer. Useful when you want to migrate without
running `translate` (e.g., in a one-shot CI codemod). Drops the legacy provider
cache as part of the run.

### New public API

- `sourceKey(literal, context?)` — produce the catalog storage key for a given
  source string. Stable, deterministic.
- `buildCatalog(entries)` — convenience for hand-rolled catalogs (tests,
  programmatic overrides). Hashes literal keys, passes `t.*` tree keys through.

### `chunkBits` config

```ts
defineConfig({
  // ...
  catalog: {
    chunkBits: 4, // default — 16 buckets. Range 0..12.
  },
});
```

| `chunkBits` | Buckets              | When to pick                                    |
| ----------- | -------------------- | ----------------------------------------------- |
| `0`         | 1 (single flat file) | tiny apps (<100 strings), simplest mental model |
| `4`         | 16                   | **default** — 100 to ~10k strings               |
| `8`         | 256                  | very large catalogs                             |
| `12`        | 4096                 | enterprise scale, massive lazy-load surface     |

### Performance trade-off

Translator hot path adds one SHA-256 of the literal key per `t()` call: roughly
1.1µs/call (was 0.4µs). Still ~50× under the published <50µs/call target.
Catalog gzipped size is unchanged at the bench.
