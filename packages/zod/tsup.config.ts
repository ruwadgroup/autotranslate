import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    source: 'src/source.ts',
    next: 'src/next.ts',
    remix: 'src/remix.ts',
  },
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'node20',
  external: ['next', 'zod'],
  onSuccess: async () => {
    const src = 'src/catalog';
    const dest = 'dist/catalog';
    mkdirSync(dest, { recursive: true });
    for (const file of readdirSync(src)) {
      if (file.endsWith('.json')) copyFileSync(join(src, file), join(dest, file));
    }
  },
});
