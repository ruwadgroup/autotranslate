import { T } from '@autotranslate/react';
import Counter from './components/Counter';
import Hero from './components/Hero';
import LinkButton from './components/LinkButton';
import LocaleCard from './components/LocaleCard';
import LocaleSwitcher from './components/LocaleSwitcher';
import StatsCard from './components/StatsCard';

interface AppProps {
  readonly locale: string;
  readonly locales: ReadonlyArray<string>;
  readonly onChangeLocale: (locale: string) => void;
}

const lastUpdated = new Date(Date.now() - 1000 * 60 * 60 * 3);
const nextRelease = new Date('2026-05-15T00:00:00Z');

export default function App({ locale, locales, onChangeLocale }: AppProps) {
  return (
    <main className="app">
      <header className="app__header">
        <span className="app__brand">
          <svg viewBox="0 0 48 46" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path
              fill="currentColor"
              d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94Z"
            />
          </svg>
          autotranslate
        </span>
        <LocaleSwitcher current={locale} locales={locales} onChange={onChangeLocale} />
      </header>

      <Hero />

      <LocaleCard lang={locale} />

      <StatsCard
        status="shipped"
        visitors={1234}
        revenue={12_499}
        lastUpdated={lastUpdated}
        nextRelease={nextRelease}
      />

      <Counter />

      <div className="actions">
        <LinkButton href="https://github.com/tamimbinhakim/autotranslate" variant="primary">
          <T>View on GitHub</T>
        </LinkButton>
        <LinkButton href="https://github.com/tamimbinhakim/autotranslate/blob/main/ROADMAP.md">
          <T>Read the roadmap</T>
        </LinkButton>
      </div>

      <footer className="footer">
        <T>Built with Vite, React, and autotranslate.</T>
      </footer>
    </main>
  );
}
