# Debugging missing keys

A string showing in English when the rest of the page is French. Six symptoms,
six diagnoses.

## Symptom 1 - Source string renders verbatim

```tsx
<button>{t('Sign out')}</button>
// rendered: "Sign out" (in fr-FR)
```

The runtime fell back to source. Either:

1. **The key is missing in the catalog.** Run `npx autotranslate check`. If
   `Sign out` is reported missing in `fr`, run
   `npx autotranslate translate --locale fr` to generate it.

2. **Watch the dev server console.** In dev mode the runtime logs a warn-once
   message when a key falls back:

   ```
   [autotranslate] missing translation for "Sign out" in locale "fr" - falling back to source
   ```

   This prints once per (key, locale) pair per process restart. If you see it,
   the key is genuinely absent from the catalog for that locale.

3. **The catalog isn't loaded.** Verify your `<TranslationProvider>` is passing
   the right `catalog` prop:

   ```tsx
   <TranslationProvider locale="fr" catalog={catalogs.fr}>
   ```

   Log the catalog: `console.log(Object.keys(catalogs.fr))` and confirm
   `'Sign out'` is among them.

4. **The locale doesn't match.** `useLocale()` should return `'fr'`. If it
   returns `'fr-FR'` or `'en'`, the provider is set wrong.

## Symptom 2 - Old translation after edit

```tsx
<T>Welcome back!</T>
// rendered: "Bienvenue!" (was the old source)
```

The structural key didn't change because the JSX didn't actually change. Or,
more often, the cache hasn't been invalidated.

1. **Run `npx autotranslate extract`.** Then inspect the affected chunk under
   `.translations/en/` (e.g. `.translations/en/3.json`) and confirm the entry
   matches the current source. Stale entries point at outdated cache state.

2. **Check the cache.**
   `.translations/.cache/<provider-sig>/<source-fr>/<chunk>.json` keys by source
   hash. If the source changed and the hash didn't move, ICU formatting may have
   changed but the canonical-key derivation didn't catch it. File a bug.

3. **The cache is doing its job.** Only changed strings re-translate; the
   per-chunk cache keys on the source hash. If the AI got it wrong on the first
   run and your source didn't change, lock the correct value in `overrides` - it
   wins over both the cache and the provider on the next run.

## Symptom 3 - `[autotranslate] No active translator`

```
[autotranslate] No active translator (called from t()).
Wrap the call in `withTranslator(t, fn)` or call `bindTranslator(t)` at startup.
```

The standalone `t()` is being called outside a translator scope. Three likely
causes:

1. **Server Action not wrapped.** Missing `withRequestTranslator(...)` in the
   action body. Add it:

   ```ts
   import * as catalogModule from '../../.translations';

   export async function action() {
     return withRequestTranslator(
       async () => {
         // t() calls in here see the request locale
       },
       { module: catalogModule },
     );
   }
   ```

2. **Zod error map runs before bind.** If
   `z.config({ customError: zodErrorMap })` is set at module load and the first
   validation runs before any `withTranslator`/`bindTranslator` call, the map
   throws. Either:
   - Bind a default translator at app boot (SPA pattern), or
   - Switch to `createZodErrorMap(translatorOrOptions)` (explicit binding).

3. **Background job missing scope.** Worker / queue handlers need
   `withTranslator(translator, async () => { ... })` per job.

## Symptom 4 - TypeScript thinks the key is wrong

```ts
t('Sign out');
// Argument of type '"Sign out"' is not assignable to parameter of type ...
```

`generate-types` hasn't been run since you added the key.

```bash
npx autotranslate extract
npx autotranslate generate-types
```

Verify `.translations/types.d.ts` includes the key:

```ts
declare module '@autotranslate/core' {
  interface AutotranslateCatalog {
    'Sign out': true; // <- should be here
    // ...
  }
}
```

And check your `tsconfig.json` includes the file:

```jsonc
{ "include": ["src", ".translations/types.d.ts"] }
```

## Symptom 5 - `<T>` content shows the source even with a catalog

```tsx
<T>
  Hello, <Var>{name}</Var>!
</T>
```

The structural key derivation depends on whitespace matching React's JSX
runtime. If `extract` and the runtime disagree on whitespace, the keys don't
match and lookup misses.

This is a bug if it happens. File an issue with the JSX in question; the
extractor's whitespace handling has a comprehensive test suite, but edge cases
exist.

To identify which hash the extractor assigned, run:

```bash
npx autotranslate find <12-hex-hash>
```

This looks up a structural key by its hash (the hash appears in the catalog as
`t.9f3a1c2b4d5e` and in the dev console when the lookup misses).

## Symptom 6 - WIRE_FORMAT version mismatch

```
[autotranslate] version mismatch: @autotranslate/next expects @autotranslate/core
wire format 2, but the loaded core reports 1. Pin both packages to the same release.
```

`@autotranslate/next` checks `WIRE_FORMAT_VERSION` from `@autotranslate/core` on
the first `getT` call. If a transitive dependency pulls in a different core
release, this error is thrown instead of silently corrupting the runtime.

Fix: pin both to the same release in your `package.json`:

```json
{
  "@autotranslate/next": "1.4.0",
  "@autotranslate/core": "1.4.0"
}
```

Run `pnpm install` (or your package manager) to resolve.

## General debugging

### Use the pseudo provider in dev

Gate the provider on an environment variable in `autotranslate.config.ts`:

```ts
provider: process.env.PSEUDO
  ? { name: 'stub', pseudo: true }
  : { name: 'ai', model: 'anthropic:claude-haiku-4-5' },
```

Run `PSEUDO=1 pnpm dev` and every translated string renders as `⟦ Šíǵñ óúţ ⟧`.
Anything that comes through as plain English in this mode wasn't wrapped in
`<T>` / `useT()`.

### Log what `t()` returns

```tsx
const t = useT();
const value = 'Sign out';
console.log({ key: value, resolved: t(value) });
```

### `autotranslate check` in CI

Catches three classes of problem before they ship:

- **`missing`** - key in source, absent in target
- **`orphan`** - key in target, no longer in source
- **`invalid-icu`** - string entry that doesn't parse as ICU MessageFormat

Wire it into PRs. Block on non-zero.

## Tips

- **Set `DEBUG=*`** when running the CLI to see the full error stack.
- **`autotranslate translate --locale fr`** retranslates only French - faster
  than waiting for the whole tree.
- **Manually edit `.translations/<locale>/<chunk>.json`** for one-off fixes
  during debug. Move them into `overrides` once you've confirmed.
