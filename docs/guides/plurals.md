# Plurals & branches

Two ways to express conditional copy: ICU `plural` for counts, ICU `select` (or
the `<Branch>` JSX marker) for arbitrary discriminators.

## Plural in JSX

```tsx
import { Plural, T } from '@autotranslate/react';

<T>
  You have <Plural value={count} one="1 message" other="# messages" />.
</T>;
```

- `value` - the count
- `name` - the slot identifier (defaults to `'count'`)
- `zero`, `one`, `two`, `few`, `many`, `other` - CLDR plural categories
- `#` - replaced with the formatted count
- `other` is required at extraction time

## Plural in strings

```ts
const t = useT();

t('{count, plural, one {# message} other {# messages}}', { count });
```

Same primitive as `<Plural>`. Use whichever reads better at the call site.

## CLDR categories - what each language uses

The runtime resolves the category via `Intl.PluralRules` for the active locale.

| Locale | Categories used                              | Notes                                    |
| ------ | -------------------------------------------- | ---------------------------------------- |
| `en`   | `one`, `other`                               | 1 vs everything else                     |
| `fr`   | `one`, `many`, `other`                       | `0` and `1` are `one`                    |
| `pl`   | `one`, `few`, `many`, `other`                | 1 / 2-4 / 5+ / fractions                 |
| `ru`   | `one`, `few`, `many`, `other`                | 1, 21, 31... / 2-4 / 0, 5-20 / fractions |
| `ar`   | `zero`, `one`, `two`, `few`, `many`, `other` | Six-way                                  |
| `ja`   | `other`                                      | No plural distinction                    |
| `zh`   | `other`                                      | No plural distinction                    |

You only need to provide `other` in the source. The translator picks up the
extra forms per locale where it matters.

## Explicit numeric matches

```
{count, plural, =0 {You have no messages} =1 {You have a message} other {You have # messages}}
```

`=0`, `=1`, etc. match the _exact_ numeric value before CLDR category lookup.
Useful for "no messages" / "one message" copy that doesn't fit the generic `one`
template.

## Branches

For non-count discriminators (status, size, role...):

```tsx
import { Branch, T, Var } from '@autotranslate/react';

<T>
  <Branch branch={role} admin={<>Admin tools</>} editor={<>Editor tools</>}>
    Read-only access
  </Branch>
</T>;
```

- `branch` - the discriminator value (coerced to string)
- Every prop other than `branch`, `name`, and `children` is a named case
- `children` is the fallback when no case matches

In strings, the same shape lives in ICU `select`:

```ts
t(
  '{role, select, admin {Admin tools} editor {Editor tools} other {Read-only access}}',
  { role },
);
```

## Combining counts and branches

Nest them. ICU handles the combination:

```ts
t(
  `{role, select,
    admin {{count, plural, one {1 admin task} other {# admin tasks}}}
    other {{count, plural, one {1 task} other {# tasks}}}
  }`,
  { role, count },
);
```

In JSX:

```tsx
<T>
  <Branch
    branch={role}
    admin={
      <>
        <Plural value={count} one="1 admin task" other="# admin tasks" />
      </>
    }
  >
    <Plural value={count} one="1 task" other="# tasks" />
  </Branch>
</T>
```

## Tips

- **Author `other` first.** It's the only required form. Other forms get added
  per locale during translation if the model needs them.

- **Prefer JSX markers over inline ICU when the message is component-rich.**
  `<T>You have <Plural value={count} one="1 unread message" other="# unread messages" /></T>`
  composes naturally; the same in inline ICU is harder to read.

- **`#` not `{count}`.** `#` resolves to the formatted count using the active
  locale's number formatter. `{count}` works too but bypasses formatting.

- **Don't switch on language.** `if (locale === 'fr') ...` is a code smell -
  ICU's `select` should cover it, or you should add per-locale strings via
  `overrides`.
