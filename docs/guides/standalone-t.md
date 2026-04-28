# Standalone `t()`

`@autotranslate/core/t` (also reachable as `@autotranslate/core/standalone`)
exposes a synchronous translator that works outside React — validators, async
work queues, route handlers, tests, anywhere `useT()` can't reach.

```ts
import { t } from '@autotranslate/core/t';

t('Sign out');
t('Hello, {name}!', { name: 'Ada' });
```

For `t()` to know which locale to render, you bind a translator first.

## Binding a translator

Two patterns: scoped (per-request) and ambient (process-wide).

### Scoped — `withTranslator(t, fn)`

Right for servers and tests. Restores the previous binding on exit; works across
`await` boundaries via `AsyncLocalStorage`.

```ts
import { createTranslator } from '@autotranslate/core';
import { withTranslator } from '@autotranslate/core/standalone';
import frCatalog from '../.translations/fr.json';

const translator = createTranslator({ locale: 'fr', catalog: frCatalog });

await withTranslator(translator, async () => {
  await validateForm(input); // any t() call inside sees `fr`
});
```

In Next.js Server Actions, Remix loaders, and similar request-scoped server
code, this is the right shape — concurrent requests with different locales stay
isolated.

### Ambient — `bindTranslator(t)`

Right for SPA bootstrap and one-process apps. Sets the translator for the rest
of the async chain (no automatic restore).

```ts
import {
  bindTranslator,
  createTranslator,
} from '@autotranslate/core/standalone';

bindTranslator(createTranslator({ locale, catalog }));

// later, anywhere
import { t } from '@autotranslate/core/t';
t('Sign out');
```

On locale switch, call `bindTranslator(...)` again with the new translator.

## Reading the translator directly

If you need access to `tree()` / `raw()` / `locale`:

```ts
import { currentTranslator } from '@autotranslate/core/standalone';

const translator = currentTranslator();
translator.locale; // 'fr'
translator.t('Sign out'); // 'Se déconnecter'
translator.tree('t.abc'); // structured tree or undefined
```

`currentTranslator()` throws if no translator is bound. Use the optional
`caller` arg to attach a callsite to the error message:

```ts
const translator = currentTranslator('zodErrorMap');
// → "[autotranslate] No active translator (called from zodErrorMap). …"
```

## Browser support

The Node entry uses `AsyncLocalStorage` for per-request isolation. Browsers load
a slot-backed fallback automatically via the `browser` export condition —
isolation reduces to "the most recently bound translator." That's correct for
SPA bootstrap; it's not the right shape for SSR. If you're rendering on the
server, use the Node entry (which is the default).

## Type-safe keys

The standalone `t()` is typed against the same `AutotranslateCatalog` interface
as `useT`. After `autotranslate generate-types`, both narrow to the literal key
set:

```ts
import { t } from '@autotranslate/core/t';

t('Sign out'); // ✓
t('Sing out'); // ✗ TS error
```

See [Type safety](typesafety.md).

## When to use it

- **Zod error maps** — see [Zod integration](../integrations/zod.md).
- **Form validators** — `react-hook-form`, `tanstack-form`, `zod-form-data`, all
  flow through.
- **Server Actions / route handlers** — pair with `withRequestTranslator` from
  `@autotranslate/zod/{next,remix}`.
- **Worker queues / cron jobs** — bind once per job, translate inside.
- **Tests** — `withTranslator(testTranslator, () => ...)` makes assertions
  deterministic.

## When NOT to use it

- Inside React components. `useT()` re-renders on locale change; standalone
  `t()` won't trigger a re-render on its own.
- For one-off renders inside `<T>`. The JSX path is what `<T>` exists for.

## API

```ts
import {
  bindTranslator,
  withTranslator,
  currentTranslator,
  t,
  createTranslator,
} from '@autotranslate/core/standalone';

bindTranslator(translator: Translator): void;
withTranslator<R>(translator: Translator, fn: () => R): R;
currentTranslator(caller?: string): Translator;
t(key: CatalogKey, params?: Readonly<Record<string, unknown>>): string;
```

Or import `t` from the dedicated alias:

```ts
import { t } from '@autotranslate/core/t';
```

Both subpaths point at the same module.
