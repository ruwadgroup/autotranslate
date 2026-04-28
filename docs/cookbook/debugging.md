# Debugging missing keys

A string showing in English when the rest of the page is French. Three symptoms,
three diagnoses.

## Symptom 1 — Source string renders verbatim

```tsx
<button>{t('Sign out')}</button>
// rendered: "Sign out" (in fr-FR)
```

The runtime fell back to source. Either:

1. **The key is missing in the catalog.** Run `npx autotranslate check`. If
   `Sign out` is reported missing in `fr.json`, run
   `npx autotranslate translate` to generate it.

2. **The catalog isn't loaded.** Verify your `<TranslationProvider>` is passing
   the right `catalog` prop:

   ```tsx
   <TranslationProvider locale="fr" catalog={catalogs.fr}>
   ```

   Log the catalog: `console.log(Object.keys(catalogs.fr))` and confirm
   `'Sign out'` is among them.

3. **The locale doesn't match.** `useLocale()` should return `'fr'`. If it
   returns `'fr-FR'` or `'en'`, the provider is set wrong.

## Symptom 2 — Old translation after edit

```tsx
<T>Welcome back!</T>
// rendered: "Bienvenue!" (was the old source)
```

The structural key didn't change because the JSX didn't actually change. Or,
more often, the cache hasn't been invalidated.

1. **Run `npx autotranslate extract`.** Verify the key in
   `.translations/en.json` matches the current source. Stale entries point at
   outdated cache state.

2. **Check the cache.** `.translations/.cache/<sig>.json` keys by source hash.
   If the source changed and the hash didn't move, ICU formatting may have
   changed but the canonical-key derivation didn't catch it. File a bug.

3. **Translation is queued, not executed.** Without `--force`, only changed
   strings re-translate. If the AI got it wrong on the first run and your source
   didn't change, edit the entry in the catalog directly (or add to
   `overrides`).

## Symptom 3 — `[autotranslate] No active translator`

```
[autotranslate] No active translator (called from t()).
Wrap the call in `withTranslator(t, fn)` or call `bindTranslator(t)` at startup.
```

The standalone `t()` is being called outside a translator scope. Three likely
causes:

1. **Server Action not wrapped.** Missing `withRequestTranslator(...)` in the
   action body. Add it:

   ```ts
   export async function action() {
     return withRequestTranslator(async () => {
       // … t() calls in here see the request locale
     });
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

## Symptom 4 — TypeScript thinks the key is wrong

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
    'Sign out': true; // ← should be here
    // …
  }
}
```

And check your `tsconfig.json` includes the file:

```jsonc
{ "include": ["src", ".translations/types.d.ts"] }
```

## Symptom 5 — `<T>` content shows the source even with a catalog

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

## General debugging

### Log the active translator's lookup

```tsx
const t = useT();
const value = 'Sign out';
console.log({
  key: value,
  resolved: t(value),
  raw: useTranslationContext().catalog[value], // direct catalog read
});
```

### Use the pseudo provider in dev

```ts
// autotranslate.config.dev.ts
provider: { name: 'stub', pseudo: true }
```

Every translated string renders as `⟦ Šíǵñ óúţ ⟧`. Anything that comes through
plain English in this mode wasn't wrapped in `<T>` / `useT()`.

### `autotranslate check` in CI

Catches three classes of problem before they ship:

- **`missing`** — key in source, absent in target
- **`orphan`** — key in target, no longer in source
- **`invalid-icu`** — string entry that doesn't parse as ICU MessageFormat

Wire it into PRs. Block on non-zero.

## Tips

- **Set `DEBUG=*`** when running the CLI to see the full error stack.
- **`autotranslate translate --locale fr`** retranslates only French — faster
  than waiting for the whole tree.
- **Manually edit `.translations/<locale>.json`** for one-off fixes during
  debug. Move them into `overrides` once you've confirmed.
