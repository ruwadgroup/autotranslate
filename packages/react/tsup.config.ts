import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.tsx',
    server: 'src/server.tsx',
  },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  splitting: true,
  clean: true,
  treeshake: true,
  external: ['react', 'react-dom', 'react-dom/server'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
