import { defineConfig } from 'tsup';

// tsserver loads plugins via require() — CJS only.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['cjs'],
  dts: {
    compilerOptions: { composite: false, incremental: false },
  },
  sourcemap: true,
  clean: true,
  external: ['typescript'],
});
