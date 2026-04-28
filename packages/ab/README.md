# @autotranslate/ab

A/B copy testing for autotranslate. Variants live in your catalog and get
translated like any other string; this package picks which one to render.

```bash
pnpm add @autotranslate/ab
```

## API

```tsx
import { ABProvider, ABTest, ABVariant, useABTest } from '@autotranslate/ab';
```

### Provider

Resolve experiment assignments upstream (Vercel `flags`, GrowthBook,
LaunchDarkly, your own header) and pass the resolved map.

```tsx
<ABProvider assignments={{ 'cta-text': 'urgent' }}>
  <App />
</ABProvider>
```

### Component-style

```tsx
import { T } from '@autotranslate/react';
import { ABTest, ABVariant } from '@autotranslate/ab';

<ABTest name="cta-text">
  <ABVariant id="control">
    <T context="cta">Sign up</T>
  </ABVariant>
  <ABVariant id="urgent">
    <T context="cta">Start now — limited time</T>
  </ABVariant>
</ABTest>;
```

The matching variant renders. `control` is the fallback when no assignment
exists for the experiment.

### Hook-style

```tsx
import { useABTest } from '@autotranslate/ab';
import { useT } from '@autotranslate/react';

function CtaButton() {
  const variant = useABTest('cta-text');
  const t = useT();
  return (
    <button>
      {variant === 'urgent'
        ? t('Start now — limited time', { $context: 'cta' })
        : t('Sign up', { $context: 'cta' })}
    </button>
  );
}
```

## Vercel `flags` integration

Resolve assignments server-side with the
[`flags`](https://github.com/vercel/flags) SDK and pass them to `<ABProvider>`:

```tsx
// app/layout.tsx
import { flag } from 'flags/next';
import { ABProvider } from '@autotranslate/ab';

const ctaFlag = flag({
  key: 'cta-text',
  defaultValue: 'control',
  decide: () => 'control',
  options: ['control', 'urgent'],
});

export default async function Layout({ children }) {
  const cta = await ctaFlag();
  return <ABProvider assignments={{ 'cta-text': cta }}>{children}</ABProvider>;
}
```

The flag's `options` array doubles as the variant id list — the translator
extracts each variant string at build time, all variants get translated, and
runtime renders only the active one.

## How variants land in the catalog

Each variant is a regular `<T>` block (or `useT('...')` call). The extractor
walks them all; they end up in `.translations/{locale}/...` like every other
string. AI translation handles them all in the same batch; nothing about A/B
testing is special at the catalog layer.

Use `context` to disambiguate the source string between variants — "Sign up"
with `context="cta"` won't collide with "Sign up" elsewhere in your app.

## Cleaning up after a winner

Once an experiment ends, delete the losing `<ABVariant>` and remove the
`<ABTest>` wrapper. Orphaned catalog entries are flagged by
`autotranslate check`; the next translate run prunes them.

## License

MIT © Tamim Bin Hakim and contributors.
