import { z } from 'zod';

/**
 * BCP-47 locale tag. Permissive enough for `en`, `en-US`, `pt-BR`,
 * `zh-Hans-CN`, `sr-Latn-RS`. Strict tag validation happens at runtime via
 * `Intl.Locale` — this regex is only a fast pre-filter.
 */
const localeTagSchema = z
  .string()
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'expected a BCP-47 locale tag');

const stubProviderSchema = z.object({
  name: z.literal('stub'),
  /** Pseudo-localize each translation (wraps in brackets, accents vowels). */
  pseudo: z.boolean().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const aiProviderSchema = z.object({
  name: z.literal('ai'),
  /**
   * `<provider>:<model>` identifier consumed by `@autotranslate/providers/ai`.
   * Examples: `anthropic:claude-haiku-4-5`, `openai:gpt-4o-mini`.
   */
  model: z.string().min(1),
  apiKey: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const customProviderSchema = z.object({
  name: z.literal('custom'),
  /** Free-form options passed through to the user-supplied `translateFn`. */
  options: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Provider configuration. Each `name` selects a different provider
 * implementation; the rest of the shape varies accordingly.
 *
 * - `stub` — identity provider, optionally pseudo-localized.
 * - `ai`   — Vercel AI SDK provider; requires `model`.
 * - `custom` — user-supplied `translateFn`, wired in code.
 */
export const providerConfigSchema = z.discriminatedUnion('name', [
  stubProviderSchema,
  aiProviderSchema,
  customProviderSchema,
]);

/**
 * The full autotranslate configuration. Authored as `autotranslate.config.ts`
 * via `defineConfig` and validated by the CLI before any IO.
 */
export const autotranslateConfigSchema = z
  .object({
    /** Source locale — the locale your code is written in. */
    source: localeTagSchema.default('en'),
    /** Target locales to translate into. */
    targets: z.array(localeTagSchema).min(1),
    /** Glob patterns for source files to scan. */
    content: z.array(z.string().min(1)).min(1),
    /** Output directory for catalogs. Default: `.translations`. */
    outDir: z.string().min(1).default('.translations'),
    /** Translation provider settings. */
    provider: providerConfigSchema.default({ name: 'stub' }),
    /** Max parallel translation requests. */
    concurrency: z.number().int().positive().max(64).default(8),
    /**
     * Manual per-locale overrides. Outer keys are message keys, inner keys
     * are locales, values are the final translation. Applied after machine
     * translation.
     */
    overrides: z.record(z.string(), z.record(z.string(), z.string())).optional(),
    /**
     * Free-form instruction string passed to AI providers as a system hint
     * (tone, audience, brand voice).
     */
    instruction: z.string().optional(),
  })
  .strict();

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type StubProviderConfig = z.infer<typeof stubProviderSchema>;
export type AIProviderConfig = z.infer<typeof aiProviderSchema>;
export type CustomProviderConfig = z.infer<typeof customProviderSchema>;

/** Output type after parsing — defaults applied, all fields populated. */
export type AutotranslateConfig = z.infer<typeof autotranslateConfigSchema>;
/** Input type before parsing — what `defineConfig` accepts. */
export type AutotranslateConfigInput = z.input<typeof autotranslateConfigSchema>;

/**
 * Identity-typed config helper for `autotranslate.config.ts`.
 *
 * The generic preserves literal types (e.g. exact `targets` tuples) so
 * downstream typegen can narrow types at the call site.
 *
 * ```ts
 * import { defineConfig } from '@autotranslate/core/config';
 *
 * export default defineConfig({
 *   targets: ['es', 'fr'],
 *   content: ['src/**\/*.{ts,tsx}'],
 * });
 * ```
 *
 * Validation happens at CLI load time via `parseConfig`.
 */
export function defineConfig<const T extends AutotranslateConfigInput>(config: T): T {
  return config;
}

/**
 * Validate raw input and return a fully populated config (defaults applied).
 * Throws `z.ZodError` on invalid input.
 */
export function parseConfig(input: unknown): AutotranslateConfig {
  return autotranslateConfigSchema.parse(input);
}

/**
 * Same as `parseConfig` but returns a discriminated success/failure result
 * instead of throwing. Useful for surfacing validation errors with custom
 * formatting.
 */
export function safeParseConfig(
  input: unknown,
): z.SafeParseReturnType<AutotranslateConfigInput, AutotranslateConfig> {
  return autotranslateConfigSchema.safeParse(input);
}
