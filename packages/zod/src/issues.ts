import type * as core from 'zod/v4/core';

export interface IssueLookup {
  readonly key: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

const SIZE_ORIGINS: ReadonlySet<string> = new Set(['string', 'array', 'set', 'file', 'map']);

const KNOWN_FORMATS: ReadonlySet<string> = new Set([
  'email',
  'url',
  'uuid',
  'guid',
  'cuid',
  'cuid2',
  'ulid',
  'xid',
  'ksuid',
  'nanoid',
  'datetime',
  'date',
  'time',
  'duration',
  'ipv4',
  'ipv6',
  'cidrv4',
  'cidrv6',
  'base64',
  'base64url',
  'json_string',
  'e164',
  'jwt',
  'lowercase',
  'uppercase',
  'emoji',
]);

/** Map a Zod v4 issue to a catalog key + ICU params. `undefined` defers to the next error map in the chain. */
export function issueToLookup(issue: core.$ZodRawIssue): IssueLookup | undefined {
  switch (issue.code) {
    case 'invalid_type':
      return {
        key: 'zod.invalid_type',
        params: { expected: String(issue.expected), received: receivedType(issue.input) },
      };

    case 'too_small': {
      const origin = String(issue.origin ?? 'value');
      const minimum = toNumber(issue.minimum);
      const inclusive = issue.inclusive ?? true;
      const exact = issue.exact === true;
      const subkey = exact && SIZE_ORIGINS.has(origin) ? `${origin}.exact` : origin;
      return { key: `zod.too_small.${subkey}`, params: { minimum, inclusive } };
    }

    case 'too_big': {
      const origin = String(issue.origin ?? 'value');
      const maximum = toNumber(issue.maximum);
      const inclusive = issue.inclusive ?? true;
      const exact = issue.exact === true;
      const subkey = exact && SIZE_ORIGINS.has(origin) ? `${origin}.exact` : origin;
      return { key: `zod.too_big.${subkey}`, params: { maximum, inclusive } };
    }

    case 'invalid_format': {
      const fmt = String(issue.format);
      if (fmt === 'regex') {
        return {
          key: 'zod.invalid_format.regex',
          params: { pattern: String(issue.pattern ?? '') },
        };
      }
      if (fmt === 'starts_with') {
        return {
          key: 'zod.invalid_format.starts_with',
          params: { prefix: String(issue.prefix ?? '') },
        };
      }
      if (fmt === 'ends_with') {
        return {
          key: 'zod.invalid_format.ends_with',
          params: { suffix: String(issue.suffix ?? '') },
        };
      }
      if (fmt === 'includes') {
        return {
          key: 'zod.invalid_format.includes',
          params: { value: String(issue.includes ?? '') },
        };
      }
      if (KNOWN_FORMATS.has(fmt)) return { key: `zod.invalid_format.${fmt}` };
      return undefined;
    }

    case 'not_multiple_of':
      return { key: 'zod.not_multiple_of', params: { divisor: toNumber(issue.divisor) } };

    case 'unrecognized_keys': {
      const keys = (issue.keys as ReadonlyArray<string> | undefined) ?? [];
      return {
        key: 'zod.unrecognized_keys',
        params: { keys: keys.join(', '), count: keys.length },
      };
    }

    case 'invalid_value': {
      const values = (issue.values as ReadonlyArray<unknown> | undefined) ?? [];
      if (values.length === 1) {
        return {
          key: 'zod.invalid_value.single',
          params: { value: stringifyPrimitive(values[0]) },
        };
      }
      return {
        key: 'zod.invalid_value',
        params: { values: values.map(stringifyPrimitive).join(', ') },
      };
    }

    default:
      return undefined;
  }
}

function receivedType(input: unknown): string {
  if (input === null) return 'null';
  if (Array.isArray(input)) return 'array';
  if (input instanceof Date) return 'date';
  return typeof input;
}

function toNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return Number(value);
}

function stringifyPrimitive(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint') return `${value}n`;
  return String(value);
}
