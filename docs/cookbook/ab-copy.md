# A/B copy testing

Run two versions of a string against your traffic, measure conversion, ship the
winner. autotranslate has no built-in experimentation framework — this recipe
shows how to layer it on top of your existing variant infrastructure
(LaunchDarkly, GrowthBook, Statsig, custom flags).

## Pattern — context-disambiguated variants

The cleanest pattern: write each variant as a separate `<T>`, distinguish them
with `context`, switch via your flag system.

```tsx
import { T } from '@autotranslate/react';
import { useExperiment } from './experiments';

export function CtaButton() {
  const variant = useExperiment('signup-cta', ['control', 'urgent']);
  return (
    <button>
      {variant === 'urgent' ? (
        <T context="cta urgent">Start now — limited time</T>
      ) : (
        <T context="cta control">Sign up</T>
      )}
    </button>
  );
}
```

Each variant gets its own catalog entry, translated independently. The AI sees
them as different strings and translates each in context.

```jsonc
// .translations/fr/components/CtaButton.json
{
  "Sign up@@cta control": "Inscrivez-vous",
  "Start now — limited time@@cta urgent": "Commencer maintenant — durée limitée",
}
```

## Pattern — single key, runtime variant override

If you want both variants to share a translation key (e.g. only the English copy
differs), use the override hook on the catalog itself:

```tsx
const variant = useExperiment('signup-cta', ['control', 'urgent']);
const catalog = useMemo(
  () =>
    variant === 'urgent'
      ? { ...baseCatalog, 'Sign up': 'Start now — limited time' }
      : baseCatalog,
  [variant, baseCatalog],
);

<TranslationProvider locale={locale} catalog={catalog} fallback={baseCatalog}>
  {children}
</TranslationProvider>;
```

Caveat: this only changes the source-locale copy. Other locales still see the
base translation. Use the **context-disambiguated** pattern above if each
variant needs its own translated copy in every locale.

## Pattern — pre-translated variants per experiment

For experiments with translated variants in N locales, build the variants into a
dedicated namespace:

```ts
// src/translations/experiments.ts
export default {
  'experiments.signup-cta': {
    control: 'Sign up',
    urgent: 'Start now — limited time',
  },
};
```

```tsx
import { useTranslations } from '@autotranslate/react';

const t = useTranslations('experiments.signup-cta');
const variant = useExperiment('signup-cta', ['control', 'urgent']);
return <button>{t(variant)}</button>;
```

`autotranslate translate` picks up `experiments.signup-cta.control` and
`experiments.signup-cta.urgent` like any other dictionary key. Translators get
both variants — they read naturally side-by-side because they're in the same
chunk.

## Tracking conversions

The experiment framework reports which variant the user saw. autotranslate
doesn't get involved. A common pattern:

```ts
useEffect(() => {
  analytics.track('cta_view', { experiment: 'signup-cta', variant });
}, [variant]);
```

When a user converts, log the same `experiment` + `variant` so attribution
works.

## Cleaning up after a winner

Once you decide:

```tsx
// before
{
  variant === 'urgent' ? (
    <T context="cta urgent">Start now — limited time</T>
  ) : (
    <T context="cta control">Sign up</T>
  );
}

// after — keep the winner only
<T context="cta">Start now — limited time</T>;
```

The losing variant's catalog entry becomes orphaned. `autotranslate check` flags
it. Delete it manually, or run `autotranslate translate` and let it prune.

The `context` value can stay if you want stable keys across the experiment
lifecycle.

## Tips

- **Don't translate dynamically-built variants.** Building strings at runtime
  (`t(\`signup-${variant}\`)`) breaks extraction. Always enumerate variant keys
  explicitly.
- **Keep variants in the same chunk.** The chunked layout buckets keys by source
  file. Variants in the same component live in the same chunk — the AI sees them
  together as context, translating consistently.
- **Roll experiments back via overrides.** If a translated variant produces poor
  results in some locale, use `overrides` to override that locale's translation
  while you fix it.
- **Ship with `experiments.*` as a separate namespace** so you can ramp
  experiments without churning your main catalogs on every test.
