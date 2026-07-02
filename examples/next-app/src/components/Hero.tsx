export default function Hero() {
  return (
    <section className="flex flex-col items-start gap-6">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Powered by autotranslate
      </span>
      <h1 className="max-w-2xl text-balance text-5xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
        AI-powered i18n for any React framework.
      </h1>
      <p className="max-w-xl text-balance text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
        Write copy in your components naturally. The CLI extracts every string and translates it
        with the AI model of your choice — no JSON hierarchies, no key bookkeeping.
      </p>
      {/* data-no-translate opts this version badge out — SKU and version strings should never be translated */}
      <span
        className="inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900"
        data-no-translate
      >
        SDK v1.0-beta
      </span>
    </section>
  );
}
