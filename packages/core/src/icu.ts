import {
  type MessageFormatElement,
  type PluralOrSelectOption,
  parse,
  TYPE,
} from '@formatjs/icu-messageformat-parser';
import { getPluralCategory } from './plural';
import type { Locale } from './types';

export class ICUParseError extends Error {
  override readonly name = 'ICUParseError';
  readonly input: string;

  constructor(input: string, cause: unknown) {
    super(
      `Failed to parse ICU message: ${input.length > 80 ? `${input.slice(0, 77)}...` : input}`,
      { cause },
    );
    this.input = input;
  }
}

export function parseICU(input: string): MessageFormatElement[] {
  try {
    return parse(input, { requiresOtherClause: false });
  } catch (cause) {
    throw new ICUParseError(input, cause);
  }
}

export function formatICU(
  input: string,
  locale: Locale,
  values: Readonly<Record<string, unknown>> = {},
): string {
  return formatElements(parseICU(input), locale, values);
}

/** Names of every interpolation variable referenced by `input`. */
export function extractVariables(input: string): ReadonlyArray<string> {
  const names = new Set<string>();
  collectVariables(parseICU(input), names);
  return [...names];
}

function collectVariables(elements: ReadonlyArray<MessageFormatElement>, out: Set<string>): void {
  for (const el of elements) {
    switch (el.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        out.add(el.value);
        break;
      case TYPE.select:
      case TYPE.plural:
        out.add(el.value);
        for (const branch of Object.values(el.options) as PluralOrSelectOption[]) {
          collectVariables(branch.value, out);
        }
        break;
      case TYPE.tag:
        collectVariables(el.children, out);
        break;
      default:
        break;
    }
  }
}

function formatElements(
  elements: ReadonlyArray<MessageFormatElement>,
  locale: Locale,
  values: Readonly<Record<string, unknown>>,
): string {
  let out = '';
  for (const el of elements) {
    out += formatElement(el, locale, values);
  }
  return out;
}

function formatElement(
  el: MessageFormatElement,
  locale: Locale,
  values: Readonly<Record<string, unknown>>,
): string {
  switch (el.type) {
    case TYPE.literal:
      return el.value;

    case TYPE.argument: {
      const v = values[el.value];
      return v == null ? `{${el.value}}` : String(v);
    }

    case TYPE.number:
      return formatNumber(el.value, el.style, locale, values);

    case TYPE.date:
      return formatDate(el.value, el.style, locale, values, 'date');

    case TYPE.time:
      return formatDate(el.value, el.style, locale, values, 'time');

    case TYPE.select: {
      const key = String(values[el.value] ?? '');
      const branch = el.options[key] ?? el.options.other;
      return branch ? formatElements(branch.value, locale, values) : '';
    }

    case TYPE.plural: {
      const raw = values[el.value];
      const n = typeof raw === 'number' ? raw : Number(raw);
      const branch = Number.isFinite(n)
        ? (el.options[`=${n}`] ?? el.options[getPluralCategory(locale, n)] ?? el.options.other)
        : el.options.other;
      if (!branch) return '';
      const replacement = Number.isFinite(n) ? String(n) : '';
      return formatElements(branch.value, locale, values).replace(/#/g, replacement);
    }

    case TYPE.pound:
      return '#';

    case TYPE.tag:
      return formatElements(el.children, locale, values);

    default:
      return '';
  }
}

function formatNumber(
  name: string,
  style: unknown,
  locale: Locale,
  values: Readonly<Record<string, unknown>>,
): string {
  const raw = values[name];
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return `{${name}}`;
  const opts = readNumberStyle(style);
  try {
    return new Intl.NumberFormat(locale, opts).format(n);
  } catch {
    return String(n);
  }
}

function readNumberStyle(style: unknown): Intl.NumberFormatOptions | undefined {
  if (typeof style !== 'string') return undefined;
  if (style === 'percent') return { style: 'percent' };
  if (style === 'currency') return { style: 'currency', currency: 'USD' };
  return undefined;
}

function formatDate(
  name: string,
  style: unknown,
  locale: Locale,
  values: Readonly<Record<string, unknown>>,
  kind: 'date' | 'time',
): string {
  const raw = values[name];
  const date = raw instanceof Date ? raw : typeof raw === 'number' ? new Date(raw) : undefined;
  if (!date) return `{${name}}`;
  const opts = readDateTimeStyle(style, kind);
  try {
    return new Intl.DateTimeFormat(locale, opts).format(date);
  } catch {
    return date.toString();
  }
}

function readDateTimeStyle(
  style: unknown,
  kind: 'date' | 'time',
): Intl.DateTimeFormatOptions | undefined {
  if (typeof style !== 'string') return undefined;
  const valid: ReadonlyArray<Intl.DateTimeFormatOptions['dateStyle']> = [
    'short',
    'medium',
    'long',
    'full',
  ];
  if (!valid.includes(style as Intl.DateTimeFormatOptions['dateStyle'])) return undefined;
  return kind === 'date'
    ? { dateStyle: style as Intl.DateTimeFormatOptions['dateStyle'] }
    : { timeStyle: style as Intl.DateTimeFormatOptions['timeStyle'] };
}
