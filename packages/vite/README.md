# @autotranslate/vite

Vite plugin for autotranslate. Translates strings in dev with HMR, exposes
virtual modules per locale, and emits production catalogs at build.

```bash
pnpm add -D @autotranslate/vite
```

```ts
import { autotranslate } from '@autotranslate/vite';

export default defineConfig({
  plugins: [autotranslate()],
});
```
