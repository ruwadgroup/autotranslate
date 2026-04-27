# @autotranslate/vite

## 0.1.0

### Minor Changes

- [#30](https://github.com/tamimbinhakim/autotranslate/pull/30)
  [`25ae59b`](https://github.com/tamimbinhakim/autotranslate/commit/25ae59b65f9aa351a478cd055ff29eb9b5835d6b)
  Thanks [@tamimbinhakim](https://github.com/tamimbinhakim)! - Initial
  implementation of `@autotranslate/vite`:
  - Default-export plugin factory that resolves a `virtual:autotranslate` module
    exporting `catalogs`, `source`, and `locales` populated at build time from
    `.translations/*.json`.
  - Auto-loads `autotranslate.config.{ts,mts,js,mjs}` from the Vite project root
    via `jiti`. Plugin options override every config-derived value; pass
    `config` to skip the disk lookup entirely (useful when the same config is
    already imported in `vite.config.ts`).
  - Dev-mode HMR: watches `<outDir>` and triggers a full reload when any locale
    JSON changes, so re-running `pnpm i18n` propagates without a manual refresh.
  - `@autotranslate/vite/client` subpath ships a `client.d.ts` that declares the
    `virtual:autotranslate` module — add it to `types` in your `tsconfig` once
    and the imports type-check cleanly.
  - 6 tests covering virtual-module resolution, catalog inlining, missing-
    catalog tolerance, inline-config option, and the no-match short-circuit.

### Patch Changes

- Updated dependencies
  [[`fc6cc60`](https://github.com/tamimbinhakim/autotranslate/commit/fc6cc60e06b891d44035053b5a9e3e95e341428a),
  [`e479d12`](https://github.com/tamimbinhakim/autotranslate/commit/e479d129fb7d1f4e3c3212a6b147774472c7341c),
  [`9b95b44`](https://github.com/tamimbinhakim/autotranslate/commit/9b95b440e154f751d4bed6bbd78aa11ac9b8e995),
  [`20478b6`](https://github.com/tamimbinhakim/autotranslate/commit/20478b67c7a51d786607099a889692f1d3f7f266)]:
  - @autotranslate/core@0.1.0
