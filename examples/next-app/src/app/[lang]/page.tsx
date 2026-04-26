import { T, Var } from '@autotranslate/react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import LocaleSwitcher from './LocaleSwitcher';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const hasLocale = (value: string): value is Locale =>
  (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(value);

export default async function Home({ params }: { readonly params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start gap-8">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />

        <LocaleSwitcher current={lang} locales={SUPPORTED_LOCALES} />

        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            <T>To get started, edit the page.tsx file.</T>
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            <T>
              Looking for a starting point or more instructions? Head over to{' '}
              <a
                href="https://vercel.com/templates"
                className="font-medium text-zinc-950 dark:text-zinc-50"
              >
                Templates
              </a>{' '}
              or the{' '}
              <a
                href="https://nextjs.org/learn"
                className="font-medium text-zinc-950 dark:text-zinc-50"
              >
                Learning
              </a>{' '}
              center.
            </T>
          </p>
          <p className="text-sm text-zinc-500">
            <T>
              Active locale: <Var name="lang">{lang}</Var>.
            </T>
          </p>
        </div>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            <T>Deploy Now</T>
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            <T>Documentation</T>
          </a>
        </div>
      </main>
    </div>
  );
}
