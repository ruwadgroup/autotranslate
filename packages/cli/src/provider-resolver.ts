import type { Provider } from '@autotranslate/providers';
import { createStubProvider } from '@autotranslate/providers/stub';
import type { ResolvedConfig } from './types';

/** Instantiate the provider declared in `config.provider`. */
export async function resolveProvider(resolved: ResolvedConfig): Promise<Provider> {
  const provider = resolved.config.provider;
  switch (provider.name) {
    case 'stub':
      return createStubProvider({ ...(provider.pseudo ? { pseudo: true } : {}) });
    case 'ai': {
      const { createAIProvider } = await import('@autotranslate/providers/ai');
      return createAIProvider({
        model: provider.model,
        ...(provider.apiKey ? { apiKey: provider.apiKey } : {}),
      });
    }
    case 'deepl': {
      const { createDeepLProvider } = await import('@autotranslate/providers/deepl');
      return createDeepLProvider({
        apiKey: provider.apiKey,
        ...(provider.endpoint ? { endpoint: provider.endpoint } : {}),
        ...(provider.formality ? { formality: provider.formality } : {}),
        ...(provider.context ? { context: provider.context } : {}),
        ...(provider.localeMap ? { localeMap: provider.localeMap } : {}),
      });
    }
    case 'google': {
      const { createGoogleProvider } = await import('@autotranslate/providers/google');
      return createGoogleProvider({
        apiKey: provider.apiKey,
        ...(provider.endpoint ? { endpoint: provider.endpoint } : {}),
        ...(provider.localeMap ? { localeMap: provider.localeMap } : {}),
      });
    }
    case 'custom':
      throw new Error(
        "provider.name === 'custom' isn't supported via the CLI. Pass `provider` to " +
          'the programmatic `translate()` API instead.',
      );
  }
}
