import { T } from '@autotranslate/react';

export default function Hero() {
  return (
    <section className="hero">
      <span className="hero__pill">
        <span className="hero__dot" />
        <T>Powered by autotranslate</T>
      </span>
      <h1 className="hero__title">
        <T>AI-powered i18n for Vite + React.</T>
      </h1>
      <p className="hero__lede">
        <T>
          Write copy in your components naturally. The CLI extracts every string and translates it
          with the AI model of your choice — catalogs land in <code>.translations/</code> and HMR
          picks them up instantly.
        </T>
      </p>
    </section>
  );
}
