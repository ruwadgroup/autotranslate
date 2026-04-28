# Lazy-loading large catalogs

If your catalog is small (under ~50KB gzipped), bundle every locale and move on.
For bigger catalogs, ship one locale at a time.

## Vite — dynamic import the virtual module

```ts
import type { Catalog } from '@autotranslate/core';

const cache = new Map<string, Promise<Catalog>>();

export function loadCatalog(locale: string): Promise<Catalog> {
  const hit = cache.get(locale);
  if (hit) return hit;
  const promise = import('virtual:autotranslate').then(
    (m) => m.catalogs[locale] ?? {},
  );
  cache.set(locale, promise);
  return promise;
}
```

Vite emits one chunk per dynamic import. The active locale is fetched on first
lookup; the rest stay in chunks the user never downloads.

## Vite — per-locale chunks

If you don't want a single virtual module bundling everything:

```ts
const loaders: Record<string, () => Promise<Catalog>> = {
  en: () => import('../.translations/en.json').then((m) => m.default),
  es: () => import('../.translations/es.json').then((m) => m.default),
  fr: () => import('../.translations/fr.json').then((m) => m.default),
  ja: () => import('../.translations/ja.json').then((m) => m.default),
};

export const loadCatalog = (locale: string) =>
  loaders[locale]?.() ?? Promise.resolve({});
```

Vite chunks each `.json` separately. Trade-off: no HMR — you give up the virtual
module's reload-on-change behaviour.

## Next.js — fs-backed (server)

`fsCatalogLoader` already memoises — no extra work for App Router.

```ts
import { fsCatalogLoader } from '@autotranslate/next';

const load = fsCatalogLoader(process.cwd(), '.translations');

export default async function Layout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const catalog = await load(lang); // memoised per (cwd, outDir, lang)
  return <TranslationProvider locale={lang} catalog={catalog}>{children}</TranslationProvider>;
}
```

Catalogs only hit disk on the first request per locale per process.

## Next.js — KV / Edge Config

```ts
import { getT } from '@autotranslate/next';
import { get } from '@vercel/edge-config';
import type { Catalog } from '@autotranslate/core';

export const runtime = 'edge';

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get('locale') ?? 'en';
  const t = await getT(locale, {
    async load(l) {
      const blob = await get<Catalog>(`autotranslate:${l}`);
      return blob ?? {};
    },
  });
  return Response.json({ greeting: t.t('Welcome') });
}
```

Wire your CI to push `.translations/<locale>.json` into Edge Config (or KV, or
R2, or whatever) on every catalog change. The runtime stays fs-free.

## Cloudflare Workers — KV

```ts
export default {
  async fetch(request: Request, env: { CATALOGS: KVNamespace }) {
    const locale = new URL(request.url).searchParams.get('locale') ?? 'en';
    const blob = await env.CATALOGS.get(`autotranslate:${locale}`, 'json');
    const catalog = (blob as Catalog | null) ?? {};

    const t = createTranslator({ locale, catalog });
    return new Response(t.t('Welcome'));
  },
};
```

## React Native — bundled per-locale

Metro doesn't do dynamic JSON imports cleanly. Bundle every locale and pick at
runtime:

```ts
import en from '../translations/en.json';
import es from '../translations/es.json';
import fr from '../translations/fr.json';
import ja from '../translations/ja.json';

const catalogs = { en, es, fr, ja } as const;
```

If catalog size matters, split per-feature instead — load the
`screens/checkout/` catalog when the user opens checkout. The CLI can target
multiple roots:

```ts
defineConfig({
  // single config for the app
  content: ['src/**/*.{ts,tsx}'],
  outDir: '.translations',
});
```

Then load per-feature on demand by partitioning the catalog at build time
(custom script reading `.translations/{locale}.json` and writing
`{locale}/{feature}.json`).

## Tips

- **Cache the load promise, not the resolved value.** Concurrent calls for the
  same locale share one fetch.

- **Preload the next likely locale.** `<link rel="modulepreload">` on the
  most-likely-next-locale chunk avoids a flash on locale switch.

- **Skip lazy-loading when you can.** A 30KB catalog gzipped is smaller than one
  product photo. Don't reach for code-splitting until the bundle size actually
  hurts.

- **Don't lazy-load `fallback`.** The fallback catalog (usually English) should
  be available immediately so missed keys don't render blank.
