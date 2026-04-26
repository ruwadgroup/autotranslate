import { T } from '@autotranslate/react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Hero from '@/components/Hero';
import LinkButton from '@/components/LinkButton';
import LocaleCard from '@/components/LocaleCard';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import StatsCard from '@/components/StatsCard';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'ja'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const hasLocale = (value: string): value is Locale =>
  (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(value);

export default async function Home({ params }: { readonly params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-50 dark:bg-black">
      {/* Subtle radial gradient so the hero doesn't feel flat. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.08),_transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.15),_transparent_60%)]"
      />

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-6 py-20 sm:px-10 sm:py-28">
        <header className="flex w-full items-center justify-between gap-4">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js"
            width={88}
            height={18}
            priority
          />
          <LocaleSwitcher current={lang} locales={SUPPORTED_LOCALES} />
        </header>

        <Hero />

        <LocaleCard lang={lang} />

        <StatsCard
          status="shipped"
          visitors={1234}
          revenue={12_499}
          lastUpdated={new Date(Date.now() - 1000 * 60 * 60 * 3)}
          nextRelease={new Date('2026-05-15T00:00:00Z')}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <LinkButton href="https://github.com/tamimbinhakim/autotranslate" variant="primary">
            <T>View on GitHub</T>
          </LinkButton>
          <LinkButton href="https://github.com/tamimbinhakim/autotranslate/blob/main/ROADMAP.md">
            <T>Read the roadmap</T>
          </LinkButton>
        </div>
      </main>
    </div>
  );
}
