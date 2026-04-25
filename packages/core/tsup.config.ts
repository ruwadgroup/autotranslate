import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    config: 'src/config.ts',
    locale: 'src/locale.ts',
    icu: 'src/icu.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: true,
  clean: true,
  treeshake: true,
  target: 'node20',
});
