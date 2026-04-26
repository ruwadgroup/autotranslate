import type { Provider } from './types';

export interface DeepLProviderOptions {
  readonly apiKey: string;
  readonly endpoint?: string;
}

/**
 * Placeholder DeepL provider — landing in v0.5 per the roadmap.
 * Throws on construction so the failure surface is at config-load time, not
 * at first translation request.
 */
export function createDeepLProvider(_options: DeepLProviderOptions): Provider {
  throw new Error(
    "@autotranslate/providers/deepl is planned for v0.5 and isn't implemented yet. " +
      'Use the `ai`, `stub`, or `custom` provider for now.',
  );
}
