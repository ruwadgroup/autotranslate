import type { Catalog, Locale } from '@autotranslate/core';
import { WIRE_FORMAT_VERSION } from '@autotranslate/core';
import { type ReactElement, type ReactNode, useMemo } from 'react';
import { TranslationContext } from './context';

// Wire format this build was compiled for. Cross-checked at provider mount
// so a transitive version skew throws instead of corrupting the runtime.
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
  /**
   * The project's source locale.
   *
   * When it equals `locale` the catalog is not consulted for anything a miss
   * would not already produce - `<T>` renders its own children and `t()` its
   * own key, both of which are the source text. Declaring it lets an app pass
   * an empty catalog for that locale and skip shipping the source strings a
   * second time, and stops every render being reported as a missing
   * translation.
   */
  readonly source?: Locale;
  /** Called when a key misses both `catalog` and `fallback`. Dev-only hooks live here. */
  readonly onMissing?: (key: string, locale: Locale) => string;
  /** Wrap `<T>` in `<span data-autotranslate="<hex12>">` for devtools. Pair with `autotranslate find <hex12>`. Dev only. */
  readonly debugMarkers?: boolean;
  readonly children: ReactNode;
}

export function TranslationProvider({
  locale,
  catalog,
  fallback,
  onMissing,
  debugMarkers,
  source,
  children,
}: TranslationProviderProps): ReactElement {
  assertVersionHandshake();
  const value = useMemo(
    () => ({
      locale,
      catalog: catalog ?? {},
      // A fallback that IS the active catalog is dead weight in an RSC payload:
      // the same object serialises twice for no lookup that the first one does
      // not already answer.
      ...(fallback && fallback !== catalog ? { fallback } : {}),
      ...(source ? { source } : {}),
      ...(onMissing ? { onMissing } : {}),
      ...(debugMarkers ? { debugMarkers: true } : {}),
    }),
    [locale, catalog, fallback, onMissing, debugMarkers, source],
  );
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}
