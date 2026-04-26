import { Plural, T, Var } from '@autotranslate/react';
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

  // A small dynamic value so the <Plural> demo isn't always the same form.
  const messages = 3;

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col items-center gap-10 px-8 py-24 sm:items-start sm:px-16">
        <header className="flex w-full items-center justify-between gap-4">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
          <LocaleSwitcher current={lang} locales={SUPPORTED_LOCALES} />
        </header>

        <section className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50">
            <T>AI-powered i18n for any React framework.</T>
          </h1>
          <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            <T>
              Write copy in your components naturally. The CLI extracts every string and translates
              it with the AI model of your choice — no JSON hierarchies, no key bookkeeping.
            </T>
          </p>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <T>
              You're viewing this page in <Var name="lang">{lang}</Var>.
            </T>
          </p>
          <p className="text-base text-zinc-900 dark:text-zinc-100">
            <T>
              You have <Plural value={messages} one="1 unread message" other="# unread messages" />{' '}
              in your inbox.
            </T>
          </p>
        </section>

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 text-zinc-50 transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            href="https://github.com/tamimbinhakim/autotranslate"
            target="_blank"
            rel="noopener noreferrer"
          >
            <T>View on GitHub</T>
          </a>
          <a
            className="flex h-12 items-center justify-center rounded-full border border-zinc-300 px-6 text-zinc-900 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
            href="https://github.com/tamimbinhakim/autotranslate/blob/main/ROADMAP.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            <T>Read the roadmap</T>
          </a>
        </div>
      </main>
    </div>
  );
}
