import type { Catalog, Locale } from '@autotranslate/core';
import { WIRE_FORMAT_VERSION } from '@autotranslate/core';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { TranslationContext } from './context';

// Wire-format version this build of @autotranslate/react was compiled for.
// Cross-checked against `@autotranslate/core` at provider mount. A skew
// (e.g. transitive @autotranslate/react@beta.1 alongside core@beta.2) throws
// a clear error instead of corrupting the runtime.
const EXPECTED_CORE_WIRE_FORMAT = 2;

let handshakeChecked = false;
function assertVersionHandshake(): void {
  if (handshakeChecked) return;
  handshakeChecked = true;
  if (WIRE_FORMAT_VERSION !== EXPECTED_CORE_WIRE_FORMAT) {
    throw new Error(
      `[autotranslate] version mismatch: @autotranslate/react expects ` +
        `@autotranslate/core wire format ${EXPECTED_CORE_WIRE_FORMAT}, but the loaded core ` +
        `reports ${WIRE_FORMAT_VERSION}. Pin both packages to the same release ` +
        `(e.g. via overrides/resolutions) and re-install.`,
    );
  }
}

export interface TranslationProviderProps {
  readonly locale: Locale;
  readonly catalog?: Catalog;
  /** Source-locale catalog used as fallback when `catalog` misses a key. */
  readonly fallback?: Catalog;
  /** Called when a key misses both `catalog` and `fallback`. Dev-only hooks live here. */
  readonly onMissing?: (key: string, locale: Locale) => string;
  /**
   * Wrap `<T>` output in `<span data-autotranslate="<hex12>">` so the hash key
   * is inspectable in devtools. Pair with `autotranslate find <hex12>` to
   * locate the source string and call site. Intended for development only.
   */
  readonly debugMarkers?: boolean;
  readonly children: ReactNode;
}

export function TranslationProvider({
  locale,
  catalog,
  fallback,
  onMissing,
  debugMarkers,
  children,
}: TranslationProviderProps): ReactElement {
  assertVersionHandshake();
  const value = useMemo(
    () => ({
      locale,
      catalog: catalog ?? {},
      ...(fallback ? { fallback } : {}),
      ...(onMissing ? { onMissing } : {}),
      ...(debugMarkers ? { debugMarkers: true } : {}),
    }),
    [locale, catalog, fallback, onMissing, debugMarkers],
  );
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}
