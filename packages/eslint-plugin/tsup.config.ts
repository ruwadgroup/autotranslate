import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: {
    // tsup spawns a fresh tsc with this config; composite/incremental break
    // multi-file DTS bundling, so opt out for this pass only.
    compilerOptions: { composite: false, incremental: false },
  },
  sourcemap: true,
  clean: true,
  external: ['eslint'],
});
