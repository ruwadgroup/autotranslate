# @autotranslate/typescript-plugin

TypeScript Language Service plugin. Editor-time warning when `t('literal')` is
called with a key that isn't in the source-locale catalog yet.

```
You have not run `extract` yet on this string.
   t('Sign ouy')   ←  highlighted in the editor
```

The same check runs on `<T>` blocks via the eslint plugin. This package covers
the string side - `useT()` and standalone `t()` - and runs in real time as you
type.

## Install

```bash
pnpm add -D @autotranslate/typescript-plugin
```

Add to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@autotranslate/typescript-plugin" }]
  }
}
```

In VS Code, run **TypeScript: Select TypeScript Version → Use Workspace
Version** so the plugin is loaded by the workspace's `tsserver`. JetBrains IDEs
pick it up automatically.

## Config

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@autotranslate/typescript-plugin",
        "outDir": ".translations",
        "source": "en",
        "severity": "warning",
        "locale": "fr"
      }
    ]
  }
}
```

| option     | default                     | meaning                                            |
| ---------- | --------------------------- | -------------------------------------------------- |
| `outDir`   | `.translations`             | catalog root, relative to project root             |
| `source`   | `en`                        | source-locale folder name                          |
| `severity` | `warning`                   | `error` / `warning` / `suggestion`                 |
| `locale`   | first non-source locale dir | locale whose translations are shown as inlay hints |

## What it tracks

Imports from `@autotranslate/react`, `@autotranslate/core/t`, and
`@autotranslate/core/standalone`:

```tsx
import { useT } from '@autotranslate/react';
const t = useT();
t('Sign out'); // ← checked
```

```tsx
import { t } from '@autotranslate/core/t';
t('Welcome'); // ← checked
```

It follows aliasing (`const x = useT()`) and skips literals beginning with `t.`
(legacy dotted-path guard).

## What it does not do

- **No type generation.** Run `autotranslate generate-types` for the typed
  `Catalog` keys. The plugin is for keys that don't exist yet, before they're
  extracted.
- **No JSX `<T>` checking.** That lives in
  [`@autotranslate/eslint-plugin`](../eslint-plugin) where the rule
  infrastructure is friendlier.
- **No quick-fix yet.** Future versions may add a "run extract" code action.
