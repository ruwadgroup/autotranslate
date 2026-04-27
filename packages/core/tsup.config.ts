import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    config: 'src/config.ts',
    locale: 'src/locale.ts',
    icu: 'src/icu.ts',
    internal: 'src/internal.ts',
  },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  splitting: true,
  clean: true,
  treeshake: true,
  target: 'node20',
});
