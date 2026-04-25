# @autotranslate/core

Framework-agnostic core for
[autotranslate](https://github.com/tamimbinhakim/autotranslate). Configuration
types, runtime translator, locale resolution, ICU message formatting, and shared
utilities. No React, no filesystem, no AI provider dependencies — those live in
dedicated packages.

```bash
pnpm add @autotranslate/core
```

## Exports

| Export                       | Purpose                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `@autotranslate/core`        | Runtime translator, hashing, types                               |
| `@autotranslate/core/config` | `defineConfig`, config schema (Zod), config loader               |
| `@autotranslate/core/locale` | BCP-47 utilities, CLDR plural rules, RTL detection               |
| `@autotranslate/core/icu`    | ICU MessageFormat parser & formatter (variables, plural, select) |

Stay tuned — implementations land alongside the runtime and CLI in the next
milestone.
