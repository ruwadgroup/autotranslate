import type { Provider } from './types';

export interface GoogleProviderOptions {
  readonly apiKey: string;
  readonly projectId?: string;
}

/**
 * Placeholder Google Cloud Translation provider — landing in v0.5 per the
 * roadmap. Throws on construction so the failure surface is at config-load
 * time, not at first translation request.
 */
export function createGoogleProvider(_options: GoogleProviderOptions): Provider {
  throw new Error(
    "@autotranslate/providers/google is planned for v0.5 and isn't implemented yet. " +
      'Use the `ai`, `stub`, or `custom` provider for now.',
  );
}
