import { T, Var } from '@autotranslate/react';

interface LocaleCardProps {
  readonly lang: string;
}

export default function LocaleCard({ lang }: LocaleCardProps) {
  return (
    <section className="card">
      <p className="card__eyebrow">
        <T>Live demo</T>
      </p>
      <p className="card__line">
        <T>
          You're viewing this page in{' '}
          <Var name="lang">
            <code>{lang}</code>
          </Var>
          . Switch the pill above — every string in the tree re-renders with the matched catalog.
        </T>
      </p>
    </section>
  );
}
