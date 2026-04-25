import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
  banner: { js: '#!/usr/bin/env node' },
});
