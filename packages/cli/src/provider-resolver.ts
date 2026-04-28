import type {
  AIProviderConfig,
  DeepLProviderConfig,
  GoogleProviderConfig,
} from '@autotranslate/core/config';
import type { Provider } from '@autotranslate/providers';
import { createStubProvider } from '@autotranslate/providers/stub';
import type { ResolvedConfig } from './types';

/** Instantiate the provider declared in `config.provider`. */
export async function resolveProvider(resolved: ResolvedConfig): Promise<Provider> {
  return instantiate(resolved.config.provider);
}

async function instantiate(provider: ResolvedConfig['config']['provider']): Promise<Provider> {
  switch (provider.name) {
    case 'stub':
      return createStubProvider({ ...(provider.pseudo ? { pseudo: true } : {}) });
    case 'ai':
      return makeAi(provider);
    case 'deepl':
      return makeDeepl(provider);
    case 'google':
      return makeGoogle(provider);
    case 'hybrid': {
      const { createHybridProvider } = await import('@autotranslate/providers/hybrid');
      const ai = await makeAi(provider.ai);
      const plain =
        provider.plain.name === 'deepl'
          ? await makeDeepl(provider.plain)
          : await makeGoogle(provider.plain);
      return createHybridProvider({ ai, plain });
    }
    case 'custom':
      throw new Error(
        "provider.name === 'custom' isn't supported via the CLI. Pass `provider` to " +
          'the programmatic `translate()` API instead.',
      );
  }
}

async function makeAi(config: AIProviderConfig): Promise<Provider> {
  const { createAIProvider } = await import('@autotranslate/providers/ai');
  return createAIProvider({
    model: config.model,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
  });
}

async function makeDeepl(config: DeepLProviderConfig): Promise<Provider> {
  const { createDeepLProvider } = await import('@autotranslate/providers/deepl');
  return createDeepLProvider({
    apiKey: config.apiKey,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    ...(config.formality ? { formality: config.formality } : {}),
    ...(config.context ? { context: config.context } : {}),
    ...(config.localeMap ? { localeMap: config.localeMap } : {}),
  });
}

async function makeGoogle(config: GoogleProviderConfig): Promise<Provider> {
  const { createGoogleProvider } = await import('@autotranslate/providers/google');
  return createGoogleProvider({
    apiKey: config.apiKey,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    ...(config.localeMap ? { localeMap: config.localeMap } : {}),
  });
}
