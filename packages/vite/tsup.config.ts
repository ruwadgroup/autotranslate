import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['vite'],
});
