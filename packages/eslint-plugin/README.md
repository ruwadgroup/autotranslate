# @autotranslate/eslint-plugin

ESLint rules for autotranslate.

Planned rules:

- `no-untranslated-jsx` — flag bare string literals in JSX outside `<T>`/`useT`
- `no-dynamic-key` — `t(variable)` won't be extracted
- `valid-icu-format` — verify ICU MessageFormat strings parse
- `consistent-locale-key` — keys match config-defined source locale
- `no-orphan-translation` — keys exist in catalog but not in source
