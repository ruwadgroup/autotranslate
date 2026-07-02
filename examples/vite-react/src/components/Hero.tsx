export default function Hero() {
  return (
    <section className="hero">
      <span className="hero__pill">
        <span className="hero__dot" />
        Powered by autotranslate
      </span>
      <h1 className="hero__title">AI-powered i18n for Vite + React.</h1>
      <p className="hero__lede">
        Write copy in your components naturally. The CLI extracts every string and translates it
        with the AI model of your choice — catalogs land in <code>.translations/</code> and HMR
        picks them up instantly.
      </p>
      {/* data-no-translate opts this SKU out — version strings and IDs should never be translated */}
      <code className="hero__sku" data-no-translate>
        SDK-v1.0-beta
      </code>
    </section>
  );
}
