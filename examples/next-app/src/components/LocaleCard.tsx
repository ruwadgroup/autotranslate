interface LocaleCardProps {
  readonly lang: string;
}

/**
 * Plain JSX — auto mode wraps the text in <T> and turns {lang} into <Var>.
 * No explicit markers needed.
 */
export default function LocaleCard({ lang }: LocaleCardProps) {
  return (
    <section className="grid w-full max-w-xl gap-4 rounded-2xl border border-zinc-200 bg-white/60 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
      <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-500">Live demo</p>
      <p className="text-base text-zinc-900 dark:text-zinc-100">
        You're viewing this page in {lang}. Try the switcher above — every string is server-rendered
        in the matched locale.
      </p>
    </section>
  );
}
