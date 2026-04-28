# Migrating from gt-next / gt-react

`gt-next` is closest in spirit to autotranslate — code-first authoring + AI
translation. The shape change is mostly **going self-hosted** (catalogs in your
repo) and using the broader autotranslate toolchain.

## At a glance

| gt-next                                                     | autotranslate                                     |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `<T>Hello, {name}</T>` (managed by gt cloud)                | `<T>Hello, <Var>{name}</Var></T>` (self-hosted)   |
| `<Var>` slots                                               | `<Var>` slots ✓ same                              |
| `<Plural>`                                                  | `<Plural>` ✓ same                                 |
| Cloud-hosted translation catalogs (gt-next runtime fetches) | `.translations/{locale}/**.json` in your repo     |
| `gtTranslate` + project ID (cloud-managed)                  | Your provider config in `autotranslate.config.ts` |
| `useGT()`, `getGT()`                                        | `useT()`, `getT(locale)`                          |

## Why migrate

- **No vendor**. Your catalogs live in your repo, not behind an API key with a
  billing relationship.
- **Cheaper at scale**. Pay your AI provider directly (Anthropic / OpenAI /
  DeepL / Google) at cost — no SaaS markup.
- **Edge / on-prem friendly**. Catalogs ship with your bundle; runtime has no
  required network calls.
- **Multi-framework**. autotranslate adapters cover Next.js, Vite, Remix, React
  Native — not just Next.

The trade-off: you run the translate command yourself (typically in CI) instead
of letting a cloud do it. See the [CI/CD cookbook](../cookbook/ci-cd.md).

## Step-by-step

### 1. Swap runtime

```bash
pnpm remove gt-next gt-react @generaltranslation/runtime
pnpm add @autotranslate/react @autotranslate/core @autotranslate/next
pnpm add -D @autotranslate/cli
npx autotranslate init
```

### 2. Configure a provider

The biggest difference: you choose the AI provider explicitly. Anthropic Claude
Haiku is a strong default — fast, cheap, excellent on ICU preservation:

```ts
// autotranslate.config.ts
export default defineConfig({
  source: 'en',
  targets: ['es', 'fr', 'ja'],
  content: ['src/**/*.{ts,tsx}'],
  provider: {
    name: 'ai',
    model: 'anthropic:claude-haiku-4-5',
    apiKey: process.env.ANTHROPIC_API_KEY,
  },
});
```

Set the env var your gt-next setup didn't need; install the SDK:

```bash
pnpm add ai @ai-sdk/anthropic
export ANTHROPIC_API_KEY=...
```

### 3. Replace `<T>` (mostly) drop-in

```tsx
// before — gt-next
<T>Hello, {user.name}!</T>

// after — autotranslate (variables MUST go through <Var>)
<T>Hello, <Var>{user.name}</Var>!</T>
```

The mechanical difference: gt-next tolerates raw `{expr}` inside `<T>`;
autotranslate requires `<Var>` (or another marker) so the canonical key
derivation is deterministic. Wrap every dynamic expression.

### 4. Replace plurals + branches

```tsx
// before — gt-next
<T>
  <Plural n={count}>
    <Branch one="1 item" other="{count} items" />
  </Plural>
</T>;

// after — same primitives, slightly different syntax
import { T, Plural } from '@autotranslate/react';

<T>
  <Plural value={count} one="1 item" other="# items" />
</T>;
```

`<Branch>` exists in autotranslate too, but for non-count discriminators:

```tsx
<T>
  <Branch branch={status} pending={<>Pending</>} shipped={<>Shipped</>}>
    Status unknown
  </Branch>
</T>
```

### 5. Replace `useGT` / `getGT`

```tsx
// before
import { useGT } from 'gt-next';
const t = useGT();
t('Sign out');

// after
import { useT } from '@autotranslate/react';
const t = useT();
t('Sign out');
```

Server side:

```tsx
// before
import { getGT } from 'gt-next/server';

// after
import { getT } from '@autotranslate/next';
const t = await getT(locale);
t.t('Welcome');
```

### 6. Move proxy / locale routing

```ts
// before — gt-next/middleware
import { withGTConfig } from 'gt-next/middleware';

// after — proxy.ts (Next 16+)
import { createNextMiddleware } from '@autotranslate/next/middleware';

export default createNextMiddleware({
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'ja'],
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

### 7. Replace the runtime fetch with bundled catalogs

gt-next fetches translations from a cloud at runtime. autotranslate ships
catalogs with the build:

```tsx
// before — gt-next runtime fetch (implicit)
<GTProvider config={...}>{children}</GTProvider>

// after — load from disk (Next) or virtual module (Vite)
import { fsCatalogLoader } from '@autotranslate/next';
import { TranslationProvider } from '@autotranslate/react';

const load = fsCatalogLoader(process.cwd(), '.translations');

export default async function Layout({ children, params }) {
  const { locale } = await params;
  const [catalog, fallback] = await Promise.all([load(locale), load('en')]);
  return (
    <TranslationProvider locale={locale} catalog={catalog} fallback={fallback}>
      {children}
    </TranslationProvider>
  );
}
```

### 8. Run the pipeline

The CLI replaces gt-next's cloud-side translate step:

```bash
pnpm i18n
# = autotranslate extract && translate && generate-types
```

Wire this into CI on every PR — see the [CI/CD cookbook](../cookbook/ci-cd.md).

### 9. Migrate brand glossary

If you used gt-next's "do not translate" markers, the equivalent is `<Var>`
(opaque to translator) or `instruction` config (global guidance):

```ts
provider: {
  name: 'ai',
  model: 'anthropic:claude-haiku-4-5',
},
instruction: 'Brand: autotranslate. Never translate the brand name. Voice: friendly, modern.',
```

See [Overrides & glossaries cookbook](../cookbook/overrides-and-glossary.md).

## Things to know

- **gt-next's runtime translation** translates new strings on first hit in
  production. autotranslate's [streaming dev-mode](../guides/strings.md) gives
  the same experience in dev only — production reads from the pre-built catalog.
- **Per-environment catalogs**. With autotranslate, you can have different
  `instruction` per environment (e.g. dev pseudo-locale) by branching on
  `process.env.NODE_ENV` in `autotranslate.config.ts`.
- **Cost predictability**. autotranslate caches per-(source, target, provider) —
  repeat runs translate only what changed. Your bill is proportional to copy
  churn, not deploys.

## Next

- [Quick start](../quick-start.md)
- [Next.js framework guide](../frameworks/nextjs.md)
- [Providers guide](../guides/providers.md) — choose AI / DeepL / Google /
  hybrid
- [CI/CD cookbook](../cookbook/ci-cd.md)
