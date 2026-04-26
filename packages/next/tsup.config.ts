import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    plugin: 'src/plugin.ts',
    middleware: 'src/middleware.ts',
  },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  splitting: true,
  clean: true,
  treeshake: true,
  external: ['next', 'react', 'react-dom'],
});
