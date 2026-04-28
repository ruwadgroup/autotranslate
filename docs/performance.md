# Performance

Numbers measured against `@autotranslate/core@0.7.x` on Node 24, Apple Silicon.
Reproduce locally with `pnpm --filter @autotranslate/core bench`.

## Translator hot path

| Operation                                    | Throughput    | Per-call |
| -------------------------------------------- | ------------- | -------- |
| Plain string lookup (catalog hit)            | ~2.4M ops/sec | ~0.42 µs |
| Plain string lookup (miss → source fallback) | ~43M ops/sec  | ~0.02 µs |
| ICU plural format (`one` / `other`)          | ~480K ops/sec | ~2.07 µs |

The pure-lookup path is dominated by the runtime's `splitParams` (filtering
reserved `$context` / `$description` / `$maxChars` keys) and the catalog
`Record<string, ...>` access. ICU runs through FormatJS's `MessageFormat`
parser; the per-call cost is the format step, not the parse — parsed messages
cache per call site within the parser.

**Target**: < 50 µs/call. **Actual**: well under, including ICU.

## Catalog size

| Catalog shape     | Raw JSON | Gzipped |
| ----------------- | -------- | ------- |
| 100 short strings | 3.9 KB   | 0.5 KB  |

`flat 100-string catalog (raw 3881B, gzip 501B)` from the bench output.

**Target**: < 5 KB gzipped per 100 strings. **Actual**: ~10× under.

The chunked layout writes one file per source-file occurrence, so real catalogs
are usually much smaller than the 100-string benchmark — most chunks are 5–30
strings. Gzip ratios stay ≥ 80% on typical UI copy.

## Translation pipeline

| Phase                                 | Notes                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `extract` — full repo scan            | Linear in source-file count. ~1 ms / file with one `<T>` block on M2.                         |
| `translate` — chunkHash short-circuit | Per-chunk file read + hash compare. Sub-millisecond per chunk.                                |
| `translate` — provider call           | Dominated by the AI provider's response time. Anthropic Haiku 4.5: ~1.5–3s per 50-item batch. |
| `translate` — chunk parallelism       | `concurrency: 8` parallel chunks. Multi-locale runs scale ~linearly.                          |

Translation cost is the model, not the toolchain. autotranslate's job is to send
only what changed and skip everything else; the
[chunked-cache architecture](concepts.md) means most CI re-runs hit zero API
calls.

## Where time actually goes

For a typical app (~500 source strings, 4 target locales):

- **First translate** (cold cache): ~30s wall-clock for 4 locales. Bound by the
  AI provider's batch latency.
- **No-op re-run** (no source changes): <1s. All chunks cache-hit at the
  `chunkHash` level; zero API calls.
- **Single-string change** (1 string in 1 chunk): ~3s. One API call for one
  chunk per locale, in parallel; chunk-context (already-translated neighbours)
  sent as cached prefix on Anthropic.

## Reproducing

```bash
pnpm --filter @autotranslate/core bench
```

The bench file is under `packages/core/bench/`. New scenarios welcome — open a
PR adding to the bench suite if you find a hot path the existing suite misses.

## Methodology notes

- **Vitest bench** uses tinybench under the hood. Auto-runs each case for at
  least 500ms with adaptive sample count.
- The numbers above are from a single run on M2 / Node 24. Variance ±5% on
  similar hardware is expected.
- The "per-call" times are derived from `1 / hz × 1µs`. They include V8 inlining
  and warm-cache effects — the first 1000 calls of a fresh process are slower.

If your numbers diverge significantly,
[open an issue](https://github.com/tamimbinhakim/autotranslate/issues) with your
hardware + Node version.
