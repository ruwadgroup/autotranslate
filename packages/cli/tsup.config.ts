import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: { compilerOptions: { composite: false, incremental: false } },
    sourcemap: true,
    clean: true,
    target: 'node20',
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: false,
    target: 'node20',
    banner: { js: '#!/usr/bin/env node' },
  },
]);
