import { T } from '@autotranslate/react';

export default function Hero() {
  return (
    <section className="flex flex-col items-start gap-6">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        <T>Powered by autotranslate</T>
      </span>
      <h1 className="max-w-2xl text-balance text-5xl font-semibold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50">
        <T>AI-powered i18n for any React framework.</T>
      </h1>
      <p className="max-w-xl text-balance text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
        <T>
          Write copy in your components naturally. The CLI extracts every string and translates it
          with the AI model of your choice — no JSON hierarchies, no key bookkeeping.
        </T>
      </p>
    </section>
  );
}
