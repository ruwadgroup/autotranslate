# Formatters

`<Num>`, `<Currency>`, `<DateTime>`, and `<RelativeTime>` are locale-aware
formatters built on `Intl.NumberFormat`, `Intl.DateTimeFormat`, and
`Intl.RelativeTimeFormat`. Inside `<T>`, they behave as opaque variable slots —
the formatter renders itself, and the canonical message records the slot name.

## `<Num>`

```tsx
import { Num } from '@autotranslate/react';

<Num value={1234567.89} />;
// en-US → '1,234,567.89'
// fr-FR → '1 234 567,89'
// ja-JP → '1,234,567.89'
```

| Prop       | Type                       | Notes                                   |
| ---------- | -------------------------- | --------------------------------------- |
| `value`    | `number`                   | Either `value` or numeric `children`.   |
| `children` | `number`                   | Convenience for `<Num>{count}</Num>`.   |
| `options`  | `Intl.NumberFormatOptions` | Passed straight through.                |
| `locale`   | `string`                   | Override the active locale.             |
| `name`     | `string`                   | Slot name override (auto when omitted). |

Non-finite values render `null` so they don't show as `NaN` to users.

## `<Currency>`

```tsx
import { Currency } from '@autotranslate/react';

<Currency value={49.99} currency="USD" />;
// en-US → '$49.99'
// fr-FR → '49,99 $US'
// ja-JP → 'US$49.99'
```

`currency` is a required ISO 4217 code (`'USD'`, `'EUR'`, `'JPY'`, …). Otherwise
the props match `<Num>`.

## `<DateTime>`

```tsx
import { DateTime } from '@autotranslate/react';

<DateTime
  value={new Date()}
  options={{ weekday: 'long', month: 'short', day: 'numeric' }}
/>;
// en-US → 'Friday, Apr 24'
// fr-FR → 'vendredi 24 avr.'
// ja-JP → '4月24日金曜日'
```

Accepts `Date`, epoch milliseconds (`number`), or ISO-8601 string. Invalid
inputs render `null`.

| Prop       | Type                         |
| ---------- | ---------------------------- |
| `value`    | `Date \| number \| string`   |
| `children` | `Date \| number \| string`   |
| `options`  | `Intl.DateTimeFormatOptions` |
| `locale`   | `string`                     |
| `name`     | `string`                     |

## `<RelativeTime>`

```tsx
import { RelativeTime } from '@autotranslate/react';

<RelativeTime value={twoHoursAgo} />;
// en-US → '2 hours ago'
// fr-FR → 'il y a 2 heures'
// ja-JP → '2 時間前'
```

`value` is the target instant. The formatter picks the largest unit whose
magnitude is at least 1 (year, month, week, day, hour, minute, second). `now`
overrides the anchor (default: `Date.now()`).

| Prop       | Type                             |
| ---------- | -------------------------------- |
| `value`    | `Date \| number \| string`       |
| `children` | `Date \| number \| string`       |
| `now`      | `Date \| number \| string`       |
| `options`  | `Intl.RelativeTimeFormatOptions` |
| `locale`   | `string`                         |
| `name`     | `string`                         |

## Inside `<T>`

Formatters compose with `<T>` like any other marker — the canonical message
records a `var` slot, and the runtime renders the formatter component as the
slot value:

```tsx
<T>
  <Num value={visitors} /> visitors today — revenue{' '}
  <Currency value={revenue} currency="USD" />.
</T>
```

The extractor auto-generates slot names per formatter type (`num_0`,
`currency_0`, `dt_0`, `rel_0`). Override with `name` when you need a specific
identifier:

```tsx
<T>
  Last seen <RelativeTime name="lastSeen" value={user.lastSeen} />.
</T>
```

The `_` separator (rather than `#`) keeps the slot name a valid ICU argument
identifier, so trees round-trip through `treeToICU` and back cleanly.

## Standalone usage

Formatters render correctly outside `<T>`. They read the active locale from
`useTranslationContext` directly:

```tsx
function AccountAge({ created }: { created: Date }) {
  return (
    <p>
      Account created <RelativeTime value={created} />
    </p>
  );
}
```

This is occasionally useful for `aria-label`s and tooltips that don't sit inside
translatable copy.

## Tips

- **`<Num>` and `<Currency>` ignore extra `Intl.NumberFormat` options that the
  runtime doesn't validate.** Pass `style: 'percent'`, `notation: 'compact'`,
  etc. and they'll flow through to the underlying formatter.

- **Memoize options** outside the render path if `options` is rebuilt every
  render — the formatter's `useMemo` cache is keyed on the object identity, so a
  fresh object every render means a fresh formatter every render.

- **Use `<DateTime>` over `toLocaleString()`** in JSX so the canonical message
  records the slot.
  `t('Last updated {date}', { date: d.toLocaleString(locale) })` works but bakes
  the formatted string into the params.
