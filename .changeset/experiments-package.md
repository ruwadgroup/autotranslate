---
'@autotranslate/experiments': minor
---

New package: `@autotranslate/experiments`

Copy experiments for autotranslate. Variants live in your catalog and get
translated like any other string; the package picks which one to render.

```tsx
import {
  ExperimentProvider,
  Experiment,
  Variant,
} from '@autotranslate/experiments';

<ExperimentProvider assignments={{ 'cta-text': 'urgent' }}>
  <Experiment name="cta-text">
    <Variant id="control">
      <T context="cta">Sign up</T>
    </Variant>
    <Variant id="urgent">
      <T context="cta">Start now — limited time</T>
    </Variant>
  </Experiment>
</ExperimentProvider>;
```

Or hook-style with `useExperiment('cta-text')`.

The package doesn't ship a flag system — resolve assignments upstream with
whatever you use (Vercel `flags`, GrowthBook, LaunchDarkly, your own header) and
pass the resolved map to `<ExperimentProvider>`. The README documents the Vercel
`flags` integration as a one-paragraph adapter pattern.

Variants flow through extraction → AI translation → typegen exactly like any
other string. Use `context` to disambiguate the source string between variants.
