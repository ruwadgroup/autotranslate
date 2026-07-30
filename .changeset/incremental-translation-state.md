---
'@autotranslate/core': minor
'@autotranslate/cli': minor
'@autotranslate/providers': minor
---

Fix incremental translation: committed catalogs are now the diff baseline

`init` gitignored `.translations/.cache/`, and `translate` used that cache as
its only record of what had been translated - it never consulted the committed
catalogs. On any machine without the cache (fresh clone, new teammate, every CI
run) the entire catalog was re-sent to the provider despite valid translations
sitting in the repo.

Three defects compounded it:

- **Omitted keys deleted committed translations.** A key missing from a provider
  response (routine on large batches) was pruned from the catalog on write.
- **One failed chunk discarded the run.** Catalogs were written only after every
  task settled, so a single 429 threw away every other chunk's work.
- **Reference context was unbounded.** Every cached neighbour rode along on
  every request, growing prompts with catalog size - which is what pushed large
  batches past the point where models answer completely.

### Changes

- Translation state moves to `.translations/.state/<locale>/<chunk>.json`,
  recording the source hash behind each translation. **Commit it** - `init` no
  longer ignores anything under `outDir` and strips a stale `.cache/` line if it
  finds one. Existing `.cache/` layouts migrate on the next `translate`.
- Switching provider or model no longer invalidates anything.
- Omitted keys keep their previous translation and stay out of state, so the
  next run retries exactly those.
- Batches fail independently. `TranslateResult` gains `failures`; the CLI exits
  non-zero when any batch failed.
- Reference context is capped at 8 items.

### Batching moves to the CLI

`translate` now plans the whole run, collapses duplicate copy, and splits the
remainder into uniform batches instead of inheriting whatever landed in a hash
bucket.

- New `batchSize` config option (default 25). This is the lever when a model
  drops items.
- Identical copy under several keys is translated once and fanned out; copy with
  differing context or description still translates separately.
- The `ai` provider retries transient failures with backoff and re-asks for
  omitted keys in smaller slices.

`TranslateProgress` reports `batch` / `totalBatches` / `items` instead of
`chunkPath`.

### Upgrading

Run `npx autotranslate init` once, then commit `.translations/`. `init` removes
the stale `.gitignore` entry and the next `translate` migrates `.cache/` into
`.state/`, so no retranslation is needed.

Until `.state/` is committed, CI still has no diff input and will retranslate
the full catalog on each run - exactly the old behaviour, no worse. Projects
that never commit `.translations/` at all are unaffected.
