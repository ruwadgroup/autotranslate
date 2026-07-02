import { TranslationProvider } from '@autotranslate/react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import * as catalogModule from '../../../.translations';
import '../globals.css';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const hasLocale = (value: string): value is Locale =>
  (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(value);

export const metadata: Metadata = {
  title: 'autotranslate · Next.js example',
  description: 'AI-powered i18n end-to-end demo',
};

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const [catalog, fallback] = await Promise.all([
    catalogModule.loadCatalog(lang),
    catalogModule.loadCatalog('en'),
  ]);

  return (
    <html lang={lang} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TranslationProvider locale={lang} catalog={catalog} fallback={fallback}>
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}
