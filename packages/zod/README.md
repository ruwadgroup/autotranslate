# @autotranslate/zod

Zod v4 error map that translates standard issues through your `autotranslate`
catalog.

```bash
pnpm add @autotranslate/zod
```

## Use it

```ts
import { z } from 'zod';
import { zodErrorMap } from '@autotranslate/zod';

z.config({ customError: zodErrorMap });
```

Validation errors now flow through the active translator. Bind one with
`withTranslator(translator, fn)` for request-scoped servers, or
`bindTranslator(translator)` once at SPA boot.

## Pipe keys through your catalog

Add the package's source module to your `content` glob so the standard issue
keys land in `.translations/{locale}.json` and get translated:

```ts
// autotranslate.config.ts
defineConfig({
  content: ['src/**/*.{ts,tsx}', '@autotranslate/zod/source'],
  // …
});
```

Until you run `translate`, the package's bundled English catalog fills the gap.

## Customize

### One schema's message

```ts
import { t } from '@autotranslate/core/t';

z.string().min(8, { error: () => t('Use at least 8 characters') });
```

### One of our keys

Edit it in your catalog. Yours wins; ours is a fallback.

```jsonc
{
  "zod.too_small.array": "{minimum, plural, =1 {Pick at least one} other {Pick at least #}}",
}
```

### Custom refinements

```ts
z.string().refine(isStrong, { error: () => t('That username is taken') });
```

## Codes we don't translate

`invalid_union`, `invalid_key`, `invalid_element`, `custom` — we return
`undefined`, Zod chains to `z.locales.*()`:

```ts
z.config({
  customError: zodErrorMap,
  localeError: z.locales.fr().localeError,
});
```

## API

```ts
import {
  createZodErrorMap,
  zodErrorMap,
  issueToLookup,
} from '@autotranslate/zod';
import { withRequestTranslator } from '@autotranslate/zod/next';
// or '@autotranslate/zod/remix'
```

| Export                                     | Notes                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `zodErrorMap`                              | Reads the ambient translator. Pair with `withTranslator` / `bindTranslator`.                                              |
| `createZodErrorMap(translator \| options)` | Bind explicitly. Right for tests and programmatic flows.                                                                  |
| `issueToLookup(issue)`                     | Pure function: `$ZodRawIssue → { key, params } \| undefined`. Useful for reusing the mapping in your own error pipelines. |
| `withRequestTranslator`                    | Adapter wrapping a Next or Remix request handler in a translator scope.                                                   |

## License

MIT © Tamim Bin Hakim and contributors.
