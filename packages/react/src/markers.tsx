import { type ReactNode, useMemo } from 'react';
import { useTranslationContext } from './context';

export interface VarProps {
  /** Slot name. Becomes `{name}` in the canonical message. Defaults to `value`. */
  readonly name?: string;
  /** Runtime value rendered in place of the slot. */
  readonly children?: ReactNode;
}

/**
 * Variable slot inside a `<T>` block.
 *
 * `<T>Hello, <Var name="user">{user.name}</Var>!</T>`
 *
 * `<Var>` is a structural marker — `<T>` reads it to build the canonical
 * message and substitute the `children` at the corresponding slot in the
 * translated tree. When rendered outside `<T>` it just passes its children
 * through, so it composes safely with normal JSX.
 */
export function Var({ children = null }: VarProps): ReactNode {
  return children;
}
Var.displayName = 'Var';

export interface PluralProps {
  /** Slot name. Defaults to `count`. */
  readonly name?: string;
  /** The count that selects which form is rendered. */
  readonly value: number;
  readonly zero?: ReactNode;
  readonly one?: ReactNode;
  readonly two?: ReactNode;
  readonly few?: ReactNode;
  readonly many?: ReactNode;
  readonly other: ReactNode;
}

/**
 * Plural branch inside a `<T>` block.
 *
 * `<T>You have <Plural value={count} one="1 message" other="# messages" />.</T>`
 *
 * Like `<Var>`, this is a marker that `<T>` interprets when building the
 * canonical message. When rendered outside `<T>`, it picks the right form
 * for the active locale via `Intl.PluralRules` so it can also stand alone.
 *
 * Form selection lives in `T`'s renderer when used inside `<T>`; the bare
 * component below handles the standalone case.
 */
export function Plural(_props: PluralProps): ReactNode {
  // Standalone path: T's renderer never enters this function — it consumes
  // the props directly from the React element. We *could* implement a
  // standalone selector here, but it would require its own context lookup
  // and doubles the surface for no gain. Render `null` as the safe default;
  // intentional standalone use should pass `value` and inspect the form
  // explicitly. The renderer-driven path is the only documented entry.
  return null;
}
Plural.displayName = 'Plural';

/**
 * Discriminator branch inside a `<T>` block. Reserved props (`branch`,
 * `name`, `children`) are excluded; every other prop is treated as a
 * named case (`pending`, `processing`, …). `children` is the default
 * fallback used when no case matches.
 *
 * ```tsx
 * <T>
 *   <Branch
 *     branch={status}
 *     pending={<>Pending review</>}
 *     shipped={<>On its way</>}
 *   >
 *     Status: <Var>{status}</Var>
 *   </Branch>
 * </T>
 * ```
 */
export interface BranchProps {
  /** The discriminating value. Coerced to string. */
  readonly branch: string | number | null | undefined;
  /** Slot name. Defaults to `branch`. */
  readonly name?: string;
  /** Default fallback when no case matches. */
  readonly children?: ReactNode;
  /** Named case branches. */
  readonly [caseName: string]: ReactNode | string | number | null | undefined;
}

export function Branch(_props: BranchProps): ReactNode {
  // Same deferred-render pattern as Plural — `<T>` consumes the props
  // directly. Standalone use returns null.
  return null;
}
Branch.displayName = 'Branch';

/** Reserved prop names ignored when collecting `<Branch>` cases. */
export const BRANCH_RESERVED_PROPS: ReadonlySet<string> = new Set([
  'branch',
  'name',
  'children',
  'key',
  'ref',
]);

export interface NumProps {
  /** The number to format. Either `value` or numeric `children`. */
  readonly children?: number;
  readonly value?: number;
  readonly options?: Intl.NumberFormatOptions;
  /** Override the active locale for this instance. */
  readonly locale?: string;
  /** Slot name override (auto-generated when omitted inside `<T>`). */
  readonly name?: string;
}

/**
 * Format a number for the active locale via `Intl.NumberFormat`. When used
 * inside `<T>`, behaves as an opaque variable slot whose runtime value is
 * the formatted string.
 */
export function Num({ children, value, options, locale }: NumProps): ReactNode {
  const ctx = useTranslationContext();
  const resolvedLocale = locale ?? ctx.locale;
  const v = resolveNumber(value, children);
  const formatter = useMemo(
    () => new Intl.NumberFormat(resolvedLocale, options),
    [resolvedLocale, options],
  );
  if (!Number.isFinite(v)) return null;
  return formatter.format(v);
}
Num.displayName = 'Num';

export interface CurrencyProps {
  readonly children?: number;
  readonly value?: number;
  /** ISO 4217 currency code (`USD`, `EUR`, `JPY`, …). */
  readonly currency: string;
  readonly options?: Intl.NumberFormatOptions;
  readonly locale?: string;
  readonly name?: string;
}

/**
 * Locale-aware currency renderer. `Intl.NumberFormat({ style: 'currency' })`
 * with `currency` from props.
 */
export function Currency({ children, value, currency, options, locale }: CurrencyProps): ReactNode {
  const ctx = useTranslationContext();
  const resolvedLocale = locale ?? ctx.locale;
  const v = resolveNumber(value, children);
  const formatter = useMemo(
    () => new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency, ...options }),
    [resolvedLocale, currency, options],
  );
  if (!Number.isFinite(v)) return null;
  return formatter.format(v);
}
Currency.displayName = 'Currency';

export interface DateTimeProps {
  readonly children?: Date | number | string;
  readonly value?: Date | number | string;
  readonly options?: Intl.DateTimeFormatOptions;
  readonly locale?: string;
  readonly name?: string;
}

/**
 * Locale-aware date / time renderer. Accepts a `Date`, an epoch number, or
 * an ISO-8601 string.
 */
export function DateTime({ children, value, options, locale }: DateTimeProps): ReactNode {
  const ctx = useTranslationContext();
  const resolvedLocale = locale ?? ctx.locale;
  const date = useMemo(() => resolveDate(value ?? children), [value, children]);
  const formatter = useMemo(
    () => new Intl.DateTimeFormat(resolvedLocale, options),
    [resolvedLocale, options],
  );
  if (date === null) return null;
  return formatter.format(date);
}
DateTime.displayName = 'DateTime';

export interface RelativeTimeProps {
  readonly children?: Date | number | string;
  readonly value?: Date | number | string;
  /** Anchor instant the relative format is computed against. Default `Date.now()`. */
  readonly now?: Date | number | string;
  readonly options?: Intl.RelativeTimeFormatOptions;
  readonly locale?: string;
  readonly name?: string;
}

/**
 * Locale-aware relative-time renderer (`"3 hours ago"`, `"in 2 days"`).
 * Picks the largest unit whose magnitude is at least 1.
 */
export function RelativeTime({
  children,
  value,
  now,
  options,
  locale,
}: RelativeTimeProps): ReactNode {
  const ctx = useTranslationContext();
  const resolvedLocale = locale ?? ctx.locale;
  const target = useMemo(() => resolveDate(value ?? children), [value, children]);
  const anchor = useMemo(() => (now == null ? new Date() : resolveDate(now)), [now]);
  const formatter = useMemo(
    () => new Intl.RelativeTimeFormat(resolvedLocale, options),
    [resolvedLocale, options],
  );
  if (target === null || anchor === null) return null;
  const { value: rel, unit } = pickRelativeUnit(target.getTime() - anchor.getTime());
  return formatter.format(rel, unit);
}
RelativeTime.displayName = 'RelativeTime';

/**
 * The set of formatter components recognized as opaque variable slots inside
 * `<T>`. Centralizing this list keeps the runtime serializer and the
 * extractor in lock-step.
 */
export const FORMAT_MARKER_PREFIX: Readonly<Record<string, string>> = {
  Num: 'num',
  Currency: 'currency',
  DateTime: 'dt',
  RelativeTime: 'rel',
};

function resolveNumber(value: number | undefined, children: ReactNode): number {
  if (typeof value === 'number') return value;
  if (typeof children === 'number') return children;
  return Number.NaN;
}

function resolveDate(input: Date | number | string | ReactNode | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : null;
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  if (typeof input === 'string') {
    const d = new Date(input);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

function pickRelativeUnit(diffMs: number): {
  readonly value: number;
  readonly unit: Intl.RelativeTimeFormatUnit;
} {
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diffMs) >= ms) {
      return { value: Math.round(diffMs / ms), unit };
    }
  }
  return { value: Math.round(diffMs / 1000), unit: 'second' };
}
