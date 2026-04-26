import { T, Var } from '@autotranslate/react';

interface LocaleCardProps {
  readonly lang: string;
}

/**
 * Demonstrates `<T>` + `<Var>` in a server component. Every text node is
 * translated; the `<Var>` slot interpolates the current locale tag at
 * render time so the message stays grammatically natural in every language.
 */
export default function LocaleCard({ lang }: LocaleCardProps) {
  return (
    <section className="grid w-full max-w-xl gap-4 rounded-2xl border border-zinc-200 bg-white/60 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
      <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
        <T>Live demo</T>
      </p>
      <p className="text-base text-zinc-900 dark:text-zinc-100">
        <T>
          You're viewing this page in{' '}
          <Var name="lang">
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm dark:bg-zinc-800">
              {lang}
            </code>
          </Var>
          . Try the switcher above — every string is server-rendered in the matched locale.
        </T>
      </p>
    </section>
  );
}
