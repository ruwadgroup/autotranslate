import { type ReactNode, useMemo } from 'react';
import { useTranslationContext } from './context';

export interface VarProps {
  readonly name?: string;
  readonly children?: ReactNode;
}

/**
 * Variable slot inside a `<T>` block.
 *
 * ```tsx
 * <T>Hello, <Var name="user">{user.name}</Var>!</T>
 * ```
 */
export function Var({ children = null }: VarProps): ReactNode {
  return children;
}
Var.displayName = 'Var';

export interface PluralProps {
  readonly name?: string;
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
 * ```tsx
 * <T>You have <Plural value={count} one="1 message" other="# messages" />.</T>
 * ```
 */
export function Plural(_props: PluralProps): ReactNode {
  return null;
}
Plural.displayName = 'Plural';

export interface BranchProps {
  readonly branch: string | number | null | undefined;
  readonly name?: string;
  readonly children?: ReactNode;
  readonly [caseName: string]: ReactNode | string | number | null | undefined;
}

/**
 * Discriminator branch inside a `<T>` block. Reserved props (`branch`, `name`,
 * `children`) are excluded; every other prop is a named case. `children` is
 * the default fallback.
 */
export function Branch(_props: BranchProps): ReactNode {
  return null;
}
Branch.displayName = 'Branch';

export interface NumProps {
  readonly children?: number;
  readonly value?: number;
  readonly options?: Intl.NumberFormatOptions;
  readonly locale?: string;
  readonly name?: string;
}

/** Locale-aware number renderer (`Intl.NumberFormat`). */
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

/** Locale-aware currency renderer. */
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

/** Locale-aware date / time renderer. Accepts `Date`, epoch ms, or ISO-8601. */
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
  /** Anchor instant. Defaults to `Date.now()`. */
  readonly now?: Date | number | string;
  readonly options?: Intl.RelativeTimeFormatOptions;
  readonly locale?: string;
  readonly name?: string;
}

/** Locale-aware relative-time renderer (`"3 hours ago"`, `"in 2 days"`). */
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

function resolveNumber(value: number | undefined, children: ReactNode): number {
  if (typeof value === 'number') return value;
  if (typeof children === 'number') return children;
  return Number.NaN;
}

function resolveDate(input: Date | number | string | ReactNode | undefined): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isFinite(input.getTime()) ? input : null;
  if (typeof input === 'number' || typeof input === 'string') {
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
