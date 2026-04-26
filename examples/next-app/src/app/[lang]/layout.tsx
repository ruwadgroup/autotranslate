import { fsCatalogLoader } from '@autotranslate/next';
import { TranslationProvider } from '@autotranslate/react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

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

const load = fsCatalogLoader(process.cwd(), '.translations');

export default async function LangLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  const [catalog, fallback] = await Promise.all([load(lang), load('en')]);

  return (
    <html lang={lang} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TranslationProvider locale={lang} catalog={catalog} fallback={fallback}>
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}
