import type { Provider } from '@autotranslate/providers';
import { createStubProvider } from '@autotranslate/providers/stub';
import type { ResolvedConfig } from './types';

/**
 * Instantiate the provider declared in `config.provider`.
 *
 * Custom providers (`name: 'custom'`) are supplied programmatically via the
 * `provider` option of the public API rather than the config file, since
 * they're functions and don't survive JSON serialization. The CLI throws a
 * clear error if a custom provider is selected without an override.
 */
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
    case 'custom':
      throw new Error(
        "provider.name === 'custom' isn't supported via the CLI. Pass `provider` to " +
          'the programmatic `translate()` API instead.',
      );
  }
}
