import { t } from '@autotranslate/core/t';

/**
 * Source module the autotranslate extractor reads. Add the package path to
 * your `content` glob so these keys land in your catalog and get translated:
 *
 * ```ts
 * defineConfig({
 *   content: ['src/**\/*.{ts,tsx}', '@autotranslate/zod/source'],
 * });
 * ```
 *
 * The `t()` calls are wrapped in a function that application code never invokes.
 * They exist only so the AST extractor can pick up the literals.
 */
export function collectZodSourceKeys(): string[] {
  return [
    // invalid_type
    t('zod.invalid_type', { expected: '', received: '' }),

    // too_small (range)
    t('zod.too_small.string', { minimum: 0, inclusive: true }),
    t('zod.too_small.array', { minimum: 0, inclusive: true }),
    t('zod.too_small.set', { minimum: 0, inclusive: true }),
    t('zod.too_small.file', { minimum: 0, inclusive: true }),
    t('zod.too_small.number', { minimum: 0, inclusive: true }),
    t('zod.too_small.int', { minimum: 0, inclusive: true }),
    t('zod.too_small.bigint', { minimum: 0, inclusive: true }),
    t('zod.too_small.date', { minimum: 0, inclusive: true }),
    // too_small (exact length)
    t('zod.too_small.string.exact', { minimum: 0, inclusive: true }),
    t('zod.too_small.array.exact', { minimum: 0, inclusive: true }),
    t('zod.too_small.set.exact', { minimum: 0, inclusive: true }),
    t('zod.too_small.file.exact', { minimum: 0, inclusive: true }),

    // too_big
    t('zod.too_big.string', { maximum: 0, inclusive: true }),
    t('zod.too_big.array', { maximum: 0, inclusive: true }),
    t('zod.too_big.set', { maximum: 0, inclusive: true }),
    t('zod.too_big.file', { maximum: 0, inclusive: true }),
    t('zod.too_big.number', { maximum: 0, inclusive: true }),
    t('zod.too_big.int', { maximum: 0, inclusive: true }),
    t('zod.too_big.bigint', { maximum: 0, inclusive: true }),
    t('zod.too_big.date', { maximum: 0, inclusive: true }),
    t('zod.too_big.string.exact', { maximum: 0, inclusive: true }),
    t('zod.too_big.array.exact', { maximum: 0, inclusive: true }),
    t('zod.too_big.set.exact', { maximum: 0, inclusive: true }),
    t('zod.too_big.file.exact', { maximum: 0, inclusive: true }),

    // invalid_format
    t('zod.invalid_format.email'),
    t('zod.invalid_format.url'),
    t('zod.invalid_format.uuid'),
    t('zod.invalid_format.guid'),
    t('zod.invalid_format.cuid'),
    t('zod.invalid_format.cuid2'),
    t('zod.invalid_format.ulid'),
    t('zod.invalid_format.xid'),
    t('zod.invalid_format.ksuid'),
    t('zod.invalid_format.nanoid'),
    t('zod.invalid_format.datetime'),
    t('zod.invalid_format.date'),
    t('zod.invalid_format.time'),
    t('zod.invalid_format.duration'),
    t('zod.invalid_format.ipv4'),
    t('zod.invalid_format.ipv6'),
    t('zod.invalid_format.cidrv4'),
    t('zod.invalid_format.cidrv6'),
    t('zod.invalid_format.base64'),
    t('zod.invalid_format.base64url'),
    t('zod.invalid_format.json_string'),
    t('zod.invalid_format.e164'),
    t('zod.invalid_format.jwt'),
    t('zod.invalid_format.lowercase'),
    t('zod.invalid_format.uppercase'),
    t('zod.invalid_format.emoji'),
    t('zod.invalid_format.regex', { pattern: '' }),
    t('zod.invalid_format.starts_with', { prefix: '' }),
    t('zod.invalid_format.ends_with', { suffix: '' }),
    t('zod.invalid_format.includes', { value: '' }),

    // not_multiple_of, unrecognized_keys, invalid_value
    t('zod.not_multiple_of', { divisor: 0 }),
    t('zod.unrecognized_keys', { keys: '', count: 0 }),
    t('zod.invalid_value', { values: '' }),
    t('zod.invalid_value.single', { value: '' }),
  ];
}
