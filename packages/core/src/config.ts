import { z } from 'zod';

const localeTagSchema = z
  .string()
  .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, 'expected a BCP-47 locale tag');

const stubProviderSchema = z.object({
  name: z.literal('stub'),
  pseudo: z.boolean().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const aiProviderSchema = z.object({
  name: z.literal('ai'),
  /** `<provider>:<model>` (e.g. `anthropic:claude-haiku-4-5`, `openai:gpt-4o-mini`). */
  model: z.string().min(1),
  apiKey: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const deeplProviderSchema = z.object({
  name: z.literal('deepl'),
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional(),
  formality: z.enum(['default', 'more', 'less', 'prefer_more', 'prefer_less']).optional(),
  context: z.string().optional(),
  localeMap: z.record(z.string(), z.string()).optional(),
});

const googleProviderSchema = z.object({
  name: z.literal('google'),
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional(),
  localeMap: z.record(z.string(), z.string()).optional(),
});

const customProviderSchema = z.object({
  name: z.literal('custom'),
  options: z.record(z.string(), z.unknown()).optional(),
});

export const providerConfigSchema = z.discriminatedUnion('name', [
  stubProviderSchema,
  aiProviderSchema,
  deeplProviderSchema,
  googleProviderSchema,
  customProviderSchema,
]);

export const autotranslateConfigSchema = z
  .object({
    source: localeTagSchema.default('en'),
    targets: z.array(localeTagSchema).min(1),
    content: z.array(z.string().min(1)).min(1),
    outDir: z.string().min(1).default('.translations'),
    provider: providerConfigSchema.default({ name: 'stub' }),
    concurrency: z.number().int().positive().max(64).default(8),
    overrides: z.record(z.string(), z.record(z.string(), z.string())).optional(),
    instruction: z.string().optional(),
    dictionary: z.string().min(1).optional(),
  })
  .strict();

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type StubProviderConfig = z.infer<typeof stubProviderSchema>;
export type AIProviderConfig = z.infer<typeof aiProviderSchema>;
export type DeepLProviderConfig = z.infer<typeof deeplProviderSchema>;
export type GoogleProviderConfig = z.infer<typeof googleProviderSchema>;
export type CustomProviderConfig = z.infer<typeof customProviderSchema>;

export type AutotranslateConfig = z.infer<typeof autotranslateConfigSchema>;
export type AutotranslateConfigInput = z.input<typeof autotranslateConfigSchema>;

/**
 * Identity helper for `autotranslate.config.ts`. Preserves literal types so
 * downstream typegen can narrow at the call site.
 */
export function defineConfig<const T extends AutotranslateConfigInput>(config: T): T {
  return config;
}

export function parseConfig(input: unknown): AutotranslateConfig {
  return autotranslateConfigSchema.parse(input);
}

export function safeParseConfig(
  input: unknown,
): z.SafeParseReturnType<AutotranslateConfigInput, AutotranslateConfig> {
  return autotranslateConfigSchema.safeParse(input);
}
