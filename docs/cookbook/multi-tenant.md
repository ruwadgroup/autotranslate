# Multi-tenant translations

Some apps serve multiple brands / customers from one codebase, each with its own
copy. Three patterns, in order of complexity.

## Pattern 1 — One catalog tree per tenant (build-time)

Bake tenant-specific copy into separate builds. Best when tenants don't overlap
heavily and ship independently.

```ts
// autotranslate.config.ts (per tenant — checked in or generated from a registry)
import { defineConfig } from '@autotranslate/core/config';

export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  outDir: `.translations/${process.env.TENANT ?? 'default'}`,
  provider: { name: 'ai', model: 'anthropic:claude-haiku-4-5' },
  instruction:
    process.env.TENANT === 'acme'
      ? 'Brand: Acme. Tone: enterprise, formal.'
      : 'Brand: Default. Tone: casual, friendly.',
  overrides: tenantOverrides[process.env.TENANT ?? 'default'],
});
```

Build with `TENANT=acme pnpm i18n` → catalogs land under `.translations/acme/`.
Production reads from the matching directory at runtime via a custom loader:

```ts
import { fsCatalogLoader } from '@autotranslate/next';
const load = fsCatalogLoader(process.cwd(), `.translations/${tenant}`);
```

Pros: fully static, no runtime lookups. Cons: every tenant needs a build.

## Pattern 2 — Tenant overrides on top of a shared catalog (runtime)

One shared catalog. Each tenant has a small overrides catalog applied at runtime
over the base.

```ts
// src/translations/tenants.ts
const overrides: Record<string, Record<string, string>> = {
  acme: {
    Welcome: 'Welcome to Acme',
    'Sign out': 'Log out',
  },
  beta: {
    Welcome: 'Hi from Beta',
  },
};

export function tenantCatalog(base: Catalog, tenant: string): Catalog {
  return { ...base, ...(overrides[tenant] ?? {}) };
}
```

```tsx
import { TranslationProvider } from '@autotranslate/react';

<TranslationProvider
  locale={locale}
  catalog={tenantCatalog(catalogs[locale], tenant)}
  fallback={catalogs.en}
>
  {children}
</TranslationProvider>;
```

Pros: one build, tenant chosen at request time. Cons: tenant overrides are JS
data; not easily AI-translated.

For AI-translated tenant overrides, run a second `autotranslate` config just for
the overrides set:

```ts
// autotranslate.tenants.config.ts
export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/translations/tenants.ts'], // extracts the literal English strings
  outDir: '.translations.tenants',
  provider: { name: 'ai', model: '...' },
});
```

Run both:
`autotranslate translate && autotranslate -c autotranslate.tenants.config.ts translate`.

## Pattern 3 — Per-tenant glossary (AI instruction injection)

The simplest form of "tenant translation": one catalog, but the AI gets
tenant-specific guidance during translation. Useful when only the brand/voice
differs, not the messages themselves.

```ts
// scripts/translate-per-tenant.ts
import { loadConfig, translate } from '@autotranslate/cli';
import { tenants } from '../src/tenants';

for (const tenant of tenants) {
  const resolved = await loadConfig();
  await translate({
    ...resolved,
    config: {
      ...resolved.config,
      outDir: `.translations/${tenant.id}`,
      instruction: tenant.brandInstruction,
    },
  });
}
```

Each tenant gets its own catalog tree, all derived from the same source copy but
tuned per brand.

## Loading the right catalog at runtime

Determine the tenant before rendering:

```ts
// Next.js Server Action / route handler
import { headers } from 'next/headers';

export async function loader() {
  const tenant = (await headers()).get('x-tenant') ?? 'default';
  const t = await getT(locale, {
    outDir: `.translations/${tenant}`,
  });
  return t.t('Welcome');
}
```

Or via subdomain:

```ts
const tenant = request.headers.get('host')?.split('.')[0] ?? 'default';
```

## Tips

- **Don't mix tenants in `overrides`**. The config-level `overrides` field is
  per-locale, not per-tenant. Use a custom loader (Pattern 2) or a per-tenant
  config (Pattern 1 / 3).
- **Cache invalidation per tenant**. Since each tenant has its own `outDir`, the
  cache lives separately. Switching brand voice for one tenant doesn't
  invalidate any other's cache.
- **Type safety across tenants**. `generate-types` reads the source catalog. If
  tenants have wildly different keys, the type narrowing only covers the union.
  Most multi-tenant apps share the same keys with different translations — keep
  it that way.
- **Audit copy diffs in PR**. With per-tenant catalogs in
  `.translations/<tenant>/`, reviewers see exactly what changes per tenant on
  every PR.
