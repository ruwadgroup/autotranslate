import { Plural, T, useT, Var } from '@autotranslate/react';
import { useState } from 'react';
import heroImg from './assets/hero.png';
import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import './App.css';

interface AppProps {
  readonly locale: string;
  readonly locales: ReadonlyArray<string>;
  readonly onChangeLocale: (locale: string) => void;
}

function App({ locale, locales, onChangeLocale }: AppProps) {
  const [count, setCount] = useState(0);
  const t = useT();

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>
            <T>Get started</T>
          </h1>
          <p>
            <T>
              Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
            </T>
          </p>
        </div>
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          {t('Language')}{' '}
          <select
            value={locale}
            onChange={(event) => onChangeLocale(event.target.value)}
            aria-label={t('Language')}
          >
            {locales.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="counter" onClick={() => setCount((c) => c + 1)}>
          <T>
            Count is <Var name="count">{count}</Var>
          </T>
        </button>
        <p>
          <T>
            You have <Plural value={count} one="1 click" other="# clicks" /> so far.
          </T>
        </p>
      </section>

      <div className="ticks" />

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon" />
          </svg>
          <h2>
            <T>Documentation</T>
          </h2>
          <p>
            <T>Your questions, answered</T>
          </p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank" rel="noopener">
                <img className="logo" src={viteLogo} alt="" />
                <T>Explore Vite</T>
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank" rel="noopener">
                <img className="button-icon" src={reactLogo} alt="" />
                <T>Learn more</T>
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon" />
          </svg>
          <h2>
            <T>Connect with us</T>
          </h2>
          <p>
            <T>Join the Vite community</T>
          </p>
        </div>
      </section>

      <div className="ticks" />
      <section id="spacer" />
    </>
  );
}

export default App;
