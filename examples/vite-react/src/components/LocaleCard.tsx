interface LocaleCardProps {
  readonly lang: string;
}

/**
 * Plain JSX — auto mode wraps the text and turns {lang} into <Var>.
 */
export default function LocaleCard({ lang }: LocaleCardProps) {
  return (
    <section className="card">
      <p className="card__eyebrow">Live demo</p>
      <p className="card__line">
        You're viewing this page in {lang}. Switch the pill above — every string in the tree
        re-renders with the matched catalog.
      </p>
    </section>
  );
}
