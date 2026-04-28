---
'@autotranslate/ab': minor
---

New package: `@autotranslate/ab`

A/B copy testing for autotranslate. Variants live in your catalog and get
translated like any other string; the package picks which one to render.

```tsx
import { ABProvider, ABTest, ABVariant } from '@autotranslate/ab';

<ABProvider assignments={{ 'cta-text': 'urgent' }}>
  <ABTest name="cta-text">
    <ABVariant id="control">
      <T context="cta">Sign up</T>
    </ABVariant>
    <ABVariant id="urgent">
      <T context="cta">Start now — limited time</T>
    </ABVariant>
  </ABTest>
</ABProvider>;
```

Or hook-style with `useABTest('cta-text')`.

The package doesn't ship a flag system — resolve assignments upstream with
whatever you use (Vercel `flags`, GrowthBook, LaunchDarkly, your own header) and
pass the resolved map to `<ABProvider>`. The README documents the Vercel `flags`
integration as a one-paragraph adapter pattern.

Variants flow through extraction → AI translation → typegen exactly like any
other string. Use `context` to disambiguate the source string between variants.
