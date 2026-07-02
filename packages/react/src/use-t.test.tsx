import { buildCatalog } from '@autotranslate/core';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { TranslationProvider } from './provider';
import { useLocale, useT } from './use-t';

function wrapper(props: { locale: string; catalog?: Record<string, string> }) {
  const catalog = props.catalog ? buildCatalog(props.catalog) : undefined;
  return ({ children }: { children: ReactNode }) => (
    <TranslationProvider locale={props.locale} catalog={catalog}>
      {children}
    </TranslationProvider>
  );
}

describe('useT', () => {
  it('returns translations from the active catalog', () => {
    const { result } = renderHook(() => useT(), {
      wrapper: wrapper({ locale: 'es', catalog: { 'Sign out': 'Cerrar sesión' } }),
    });
    expect(result.current('Sign out')).toBe('Cerrar sesión');
  });

  it('formats ICU parameters', () => {
    const { result } = renderHook(() => useT(), {
      wrapper: wrapper({ locale: 'en', catalog: { greeting: 'Hello, {name}!' } }),
    });
    expect(result.current('greeting', { name: 'Ada' })).toBe('Hello, Ada!');
  });

  it('returns the key on miss when no fallback is configured', () => {
    const { result } = renderHook(() => useT(), {
      wrapper: wrapper({ locale: 'es' }),
    });
    expect(result.current('Untranslated')).toBe('Untranslated');
  });
});

describe('useLocale', () => {
  it('reflects the active provider locale', () => {
    const { result } = renderHook(() => useLocale(), {
      wrapper: wrapper({ locale: 'fr-CA' }),
    });
    expect(result.current).toBe('fr-CA');
  });
});
