# Zod

`@autotranslate/zod` translates Zod's built-in error messages and lets you
author your own translated errors with the same `t()` you use everywhere else.

```bash
pnpm add @autotranslate/zod
```

> Targets **Zod v4**. The error map signature, locale chaining, and issue codes
> documented here are v4-specific.

## Use it

```ts
import { z } from 'zod';
import { zodErrorMap } from '@autotranslate/zod';

z.config({ customError: zodErrorMap });
```

That's the wiring. Validation errors now flow through the active translator.

## Bind a translator

`zodErrorMap` reads the ambient translator at error-map call time. Bind one
upstream:

### Server-scoped (Next, Remix)

```ts
import { withRequestTranslator } from '@autotranslate/zod/next';
// or '@autotranslate/zod/remix'

export async function action(formData: FormData) {
  return withRequestTranslator(async () => {
    return userSchema.parse(Object.fromEntries(formData));
  });
}
```

The adapter pulls the request locale from your framework, scopes a translator,
and runs the body inside it. Concurrent requests with different locales stay
isolated.

### SPA bootstrap

```ts
import {
  bindTranslator,
  createTranslator,
} from '@autotranslate/core/standalone';
import { zodErrorMap } from '@autotranslate/zod';
import * as z from 'zod';
import en from '../.translations/en.json';

bindTranslator(createTranslator({ locale: 'en', catalog: en }));
z.config({ customError: zodErrorMap });
```

Re-bind on locale switch. See [Standalone `t()`](../guides/standalone-t.md).

## Pipe keys through your catalog

Add the package's source module to your `content` glob so the standard issue
keys land in `.translations/{locale}.json` and get translated by your normal
provider:

```ts
// autotranslate.config.ts
defineConfig({
  content: ['src/**/*.{ts,tsx}', '@autotranslate/zod/source'],
  // …
});
```

Until you run `autotranslate translate`, the package's bundled English catalog
fills the gap as `fallback`.

## Customise

### Override one schema's message

Zod's per-call API:

```ts
import { t } from '@autotranslate/core/t';

z.string().min(8, { error: () => t('Use at least 8 characters') });
```

The literal `'Use at least 8 characters'` is extracted by `autotranslate` like
any other `t()` call — it shows up in your catalog and gets translated alongside
everything else.

### Override one of our keys

Zod's `too_small` for arrays renders from `zod.too_small.array`. Edit it in your
catalog and your version wins:

```jsonc
// .translations/en.json
{
  "zod.too_small.array": "{minimum, plural, =1 {Pick at least one} other {Pick at least #}}",
}
```

We treat your catalog as the source of truth. Our bundled fallback only fills
gaps.

### Translate your own custom errors

Anywhere you use `.refine()`, `.check()`, or a custom validator, use the
standalone `t()`:

```ts
const username = z.string().refine(isAvailable, {
  error: () => t('That username is taken'),
});

const team = z
  .object({
    /* … */
  })
  .check(({ value, issues }) => {
    if (value.members.length > value.seats) {
      issues.push({
        code: 'custom',
        message: t('You have more members ({count}) than seats ({seats})', {
          count: value.members.length,
          seats: value.seats,
        }),
        path: ['members'],
        input: value,
      });
    }
  });
```

Same `t()` as the rest of your app. Same extraction. Same typegen.

## Codes we don't translate

If we don't have a key for an issue code (`invalid_union`, `invalid_key`,
`invalid_element`, `custom`, unknown formats), we return `undefined` — Zod
chains to `z.locales.*()`:

```ts
z.config({
  customError: zodErrorMap, // your translations
  localeError: z.locales.fr().localeError, // Zod's built-ins as fallback
});
```

You always end up with translated copy; we just don't claim ownership of every
Zod issue ourselves.

## API

```ts
import {
  zodErrorMap, // ambient — reads currentTranslator()
  createZodErrorMap, // explicit — bind to a specific translator
  issueToLookup, // pure $ZodRawIssue → { key, params } | undefined
} from '@autotranslate/zod';

// adapters
import { withRequestTranslator } from '@autotranslate/zod/next';
import { withRequestTranslator } from '@autotranslate/zod/remix';
```

```ts
const map = createZodErrorMap({ locale: 'fr', catalog: frCatalog });
z.config({ customError: map });
```

## Catalog keys we ship

The bundled English catalog covers:

- `zod.invalid_type`
- `zod.too_small.{string,array,set,file,number,int,bigint,date}` (+ `.exact`)
- `zod.too_big.{...}` (same shape)
- `zod.invalid_format.{email,url,uuid,regex,starts_with,ends_with,includes,…}`
- `zod.not_multiple_of`
- `zod.unrecognized_keys`
- `zod.invalid_value` / `zod.invalid_value.single`

## Tips

- **`@autotranslate/zod/source` belongs in `content`.** Without it, the keys
  exist only as bundled fallbacks — your translation provider never sees them.

- **Schema-level `error: () => t(...)` beats global.** Use it when one schema
  needs custom copy that isn't worth a global override.

- **Pair with `react-hook-form` / `tanstack-form`.** Both consume Zod errors as
  plain strings — translation flows through automatically. See
  [Form validation cookbook](../cookbook/form-validation.md).
