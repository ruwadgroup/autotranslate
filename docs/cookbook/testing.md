# Testing translated UI

The runtime degrades gracefully — a missing catalog renders source. Tests either
lean into that (fast, no setup) or bind a real translator (deterministic locale
assertions).

## Unit tests — render source

Render components without a `TranslationProvider` and assert the source strings:

```tsx
import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { Greeting } from './Greeting';

test('renders the source greeting', () => {
  render(<Greeting name="Ada" />);
  expect(screen.getByText('Hello, Ada!')).toBeInTheDocument();
});
```

No mocks, no provider, no catalog. The runtime falls back to source.

## Locale-specific assertions

Wrap with a `TranslationProvider` and a fixture catalog:

```tsx
import { TranslationProvider } from '@autotranslate/react';
import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';

const fr: Record<string, string> = {
  'Hello, {name}!': '¡Hola, {name}!', // intentionally Spanish to make the test fail loud
};

test('renders the French greeting', () => {
  render(
    <TranslationProvider locale="fr" catalog={fr}>
      <Greeting name="Ada" />
    </TranslationProvider>,
  );
  expect(screen.getByText('¡Hola, Ada!')).toBeInTheDocument();
});
```

## Pseudo-locale tests

Render against the pseudo provider to surface untranslated UI:

```tsx
import { TranslationProvider } from '@autotranslate/react';
import { pseudoLocalize } from '@autotranslate/providers/stub';

const pseudo: Record<string, string> = Object.fromEntries(
  Object.entries(sourceCatalog).map(([k, v]) => [
    k,
    typeof v === 'string' ? pseudoLocalize(v) : v,
  ]),
);

render(
  <TranslationProvider locale="en-XA" catalog={pseudo}>
    <App />
  </TranslationProvider>,
);
```

Snapshots taken against the pseudo locale catch any string that didn't make it
through `<T>` / `useT()`.

## Standalone `t()` in tests

`withTranslator` makes assertions deterministic:

```ts
import { createTranslator } from '@autotranslate/core';
import { withTranslator } from '@autotranslate/core/standalone';
import { test, expect } from 'vitest';
import { renderEmailBody } from './email';

test('renders the welcome email in French', () => {
  const translator = createTranslator({
    locale: 'fr',
    catalog: { 'Welcome, {name}!': 'Bienvenue, {name}!' },
  });
  withTranslator(translator, () => {
    expect(renderEmailBody({ name: 'Ada' })).toContain('Bienvenue, Ada');
  });
});
```

## Zod error-map tests

```ts
import { createZodErrorMap } from '@autotranslate/zod';
import { test, expect } from 'vitest';
import * as z from 'zod';

test('Zod errors render in French', () => {
  const errorMap = createZodErrorMap({
    locale: 'fr',
    catalog: { 'zod.invalid_type': 'Type invalide : {expected} attendu' },
    fallback: {}, // fall through to bundled defaults
  });
  z.config({ customError: errorMap });

  const r = z.string().safeParse(42);
  expect(r.success).toBe(false);
  if (!r.success) {
    expect(r.error.issues[0]?.message).toContain('Type invalide');
  }
});
```

## CI: `autotranslate check`

```bash
npx autotranslate check
```

Runs against the catalogs in `outDir`. Reports keys missing in target locales,
orphan keys, and ICU parse errors. Exits non-zero on any problem.

```yaml
# .github/workflows/i18n.yml
- run: pnpm i18n
- run: npx autotranslate check
```

## Tips

- **Avoid mocking `useT`.** A fixture catalog + `TranslationProvider` is closer
  to production behaviour and catches misuse the mock would hide.

- **Test plurals at the boundaries.** `count: 0`, `count: 1`, `count: 2` for
  English; `count: 5` and `count: 21` for Russian / Polish to cover `few` /
  `many`.

- **One snapshot per locale**. Render the same scene across `en`, your pseudo
  locale, and your most-different real locale (e.g. `ar` for RTL). Catches
  layout regressions cheaply.
