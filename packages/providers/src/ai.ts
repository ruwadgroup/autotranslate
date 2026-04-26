import type { CatalogEntry } from '@autotranslate/core';
import { z } from 'zod';
import { icuToTree, treeToICU } from './tree-icu';
import type { Provider, TranslationItem, TranslationRequest } from './types';

export interface AIProviderOptions {
  /**
   * `<vendor>:<model>` identifier. Supported vendors: `anthropic`, `openai`,
   * `google`, `openrouter`. Examples:
   *
   * - `'anthropic:claude-haiku-4-5'`
   * - `'openai:gpt-4o-mini'`
   * - `'google:gemini-2.5-flash'`
   * - `'openrouter:anthropic/claude-haiku-4-5'`
   */
  readonly model: string;
  /** API key for the chosen vendor. Falls back to vendor-default env vars. */
  readonly apiKey?: string;
  /** Free-form system instruction (tone, audience, brand voice). */
  readonly instruction?: string;
  /** Maximum number of items per `generateObject` call. Default 50. */
  readonly maxBatchSize?: number;
  /**
   * Optional escape hatch for callers that want to bypass the built-in
   * vendor resolver (e.g. to test against a custom AI Gateway). The result
   * must be an `ai-sdk`-compatible `LanguageModel`.
   */
  readonly resolveModel?: (model: string, apiKey?: string) => Promise<unknown>;
}

const DEFAULT_BATCH_SIZE = 50;

/**
 * Vercel AI SDK-backed translation provider.
 *
 * Strategy: linearize each source entry to an ICU message, batch them into a
 * single `generateObject` call, and reconstruct the tree post-translation
 * via `icuToTree`. ICU is a far better wire format than custom JSON because
 * the model already knows it — placeholders, plurals, and tags survive
 * round-trips reliably.
 */
export function createAIProvider(options: AIProviderOptions): Provider {
  const { model, apiKey, instruction, maxBatchSize = DEFAULT_BATCH_SIZE, resolveModel } = options;
  const signature = `ai:${model}${instruction ? `:${shortHash(instruction)}` : ''}`;

  return {
    name: 'ai',
    signature,
    async translate(request) {
      if (request.items.length === 0) {
        return { translations: {} };
      }
      const resolved = resolveModel
        ? await resolveModel(model, apiKey)
        : await defaultResolveModel(model, apiKey);
      const batches = chunk(request.items, maxBatchSize);
      const translations: Record<string, CatalogEntry> = {};
      for (const batch of batches) {
        const partial = await translateBatch(resolved, batch, request, instruction);
        Object.assign(translations, partial);
      }
      return { translations };
    },
  };
}

async function translateBatch(
  model: unknown,
  items: ReadonlyArray<TranslationItem>,
  request: TranslationRequest,
  instruction: string | undefined,
): Promise<Record<string, CatalogEntry>> {
  const { generateObject } = await import('ai');

  const requestPayload = items.map((item) => ({
    key: item.key,
    icu: typeof item.source === 'string' ? item.source : treeToICU(item.source),
    ...(item.context ? { context: item.context } : {}),
    ...(item.description ? { description: item.description } : {}),
    ...(typeof item.maxChars === 'number' ? { maxChars: item.maxChars } : {}),
  }));

  const responseSchema = z.object({
    translations: z.array(
      z.object({
        key: z.string(),
        icu: z.string(),
      }),
    ),
  });

  // ai-sdk's `LanguageModel` type varies between v4 and v5 and resolveModel
  // is intentionally typed as `unknown`. Cast to the SDK's expected shape;
  // the runtime contract is what matters.
  const { object } = await generateObject({
    model: model as Parameters<typeof generateObject>[0]['model'],
    schema: responseSchema,
    system: buildSystemPrompt(request.source, request.target, instruction),
    prompt: JSON.stringify(requestPayload),
    ...(request.signal ? { abortSignal: request.signal } : {}),
  });

  const out: Record<string, CatalogEntry> = {};
  const itemsByKey = new Map(items.map((i) => [i.key, i]));
  for (const entry of object.translations) {
    const original = itemsByKey.get(entry.key);
    if (!original) continue;
    out[entry.key] = typeof original.source === 'string' ? entry.icu : icuToTree(entry.icu);
  }
  return out;
}

function buildSystemPrompt(source: string, target: string, instruction?: string): string {
  const base =
    `You are a professional translator. Translate ICU MessageFormat strings ` +
    `from ${source} to ${target}. ` +
    `Preserve all placeholders ({name}, {count, plural, ...}), tag wrappers ` +
    `(<a>...</a>, <strong>...</strong>), and the overall ICU structure ` +
    `exactly. Translate only the natural-language text. Do not add commentary.`;
  return instruction ? `${base}\n\nAdditional guidance: ${instruction}` : base;
}

async function defaultResolveModel(model: string, apiKey?: string): Promise<unknown> {
  const colon = model.indexOf(':');
  if (colon === -1) {
    throw new Error(`AI provider model must be in the form '<vendor>:<model>', got '${model}'.`);
  }
  const vendor = model.slice(0, colon);
  const modelId = model.slice(colon + 1);
  if (!modelId) {
    throw new Error(`AI provider model id missing after vendor in '${model}'.`);
  }

  switch (vendor) {
    case 'anthropic': {
      const { createAnthropic } = await import('@ai-sdk/anthropic');
      return createAnthropic({ ...(apiKey ? { apiKey } : {}) })(modelId);
    }
    case 'openai': {
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({ ...(apiKey ? { apiKey } : {}) })(modelId);
    }
    case 'google': {
      const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
      return createGoogleGenerativeAI({ ...(apiKey ? { apiKey } : {}) })(modelId);
    }
    case 'openrouter': {
      // OpenRouter exposes an OpenAI-compatible API. Reuse the OpenAI factory
      // with an overridden baseURL so users don't need an extra peer dep.
      const { createOpenAI } = await import('@ai-sdk/openai');
      return createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        ...(apiKey ? { apiKey } : {}),
      })(modelId);
    }
    default:
      throw new Error(
        `Unknown AI vendor '${vendor}'. Expected one of: anthropic, openai, google, openrouter.`,
      );
  }
}

function chunk<T>(items: ReadonlyArray<T>, size: number): T[][] {
  if (size <= 0) return [items.slice()];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

// Tiny non-cryptographic hash used only to give the instruction a stable
// signature for cache-key derivation. Avoids pulling in node:crypto and
// keeps the runtime edge-safe.
function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
