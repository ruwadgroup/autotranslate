import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { TranslationProvider } from './provider';
import { useLocale, useT, useTranslations } from './use-t';

function wrapper(props: { locale: string; catalog?: Record<string, string> }) {
  return ({ children }: { children: ReactNode }) => (
    <TranslationProvider locale={props.locale} catalog={props.catalog}>
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

describe('useTranslations', () => {
  it('prefixes the key with the namespace', () => {
    const { result } = renderHook(() => useTranslations('dashboard'), {
      wrapper: wrapper({
        locale: 'en',
        catalog: { 'dashboard.title': 'Dashboard' },
      }),
    });
    expect(result.current('title')).toBe('Dashboard');
  });

  it('supports nested key paths', () => {
    const { result } = renderHook(() => useTranslations('dashboard'), {
      wrapper: wrapper({
        locale: 'en',
        catalog: {
          'dashboard.stats.visitors': '{count, plural, one {# visitor} other {# visitors}}',
        },
      }),
    });
    expect(result.current('stats.visitors', { count: 5 })).toBe('5 visitors');
  });

  it('reads root keys when namespace is omitted', () => {
    const { result } = renderHook(() => useTranslations(), {
      wrapper: wrapper({ locale: 'en', catalog: { hello: 'Hi' } }),
    });
    expect(result.current('hello')).toBe('Hi');
  });
});
