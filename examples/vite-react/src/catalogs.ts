import type { Catalog } from '@autotranslate/core';

// Vite glob import: bundles every per-locale catalog produced by
// `autotranslate translate`. The first run won't have any of these — run
// `pnpm extract && pnpm translate` to populate `.translations/`.
const modules = import.meta.glob<{ default: Catalog }>('../.translations/*.json', {
  eager: true,
});

const catalogs: Record<string, Catalog> = {};
for (const [path, mod] of Object.entries(modules)) {
  const match = path.match(/\/([^/]+)\.json$/);
  if (match?.[1] && !match[1].startsWith('.')) {
    catalogs[match[1]] = mod.default;
  }
}

export function useCatalog(locale: string): Catalog {
  return catalogs[locale] ?? {};
}
