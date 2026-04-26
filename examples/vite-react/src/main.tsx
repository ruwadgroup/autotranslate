import { TranslationProvider } from '@autotranslate/react';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { useCatalog } from './catalogs.ts';
import './index.css';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

function Root() {
  const [locale, setLocale] = useState<Locale>('en');
  const catalog = useCatalog(locale);
  const fallback = useCatalog('en');
  const onChangeLocale = (next: string) => {
    if (SUPPORTED_LOCALES.includes(next as Locale)) setLocale(next as Locale);
  };
  return (
    <TranslationProvider locale={locale} catalog={catalog} fallback={fallback}>
      <App locale={locale} locales={SUPPORTED_LOCALES} onChangeLocale={onChangeLocale} />
    </TranslationProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
