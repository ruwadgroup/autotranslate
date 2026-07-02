import { useT } from '@autotranslate/react';
import { useState } from 'react';

/**
 * HMR demo. The button uses useT() with ICU plural format instead of <Plural>
 * so this component stays pure plain-JSX + auto mode — no explicit <T> needed.
 */
export default function Counter() {
  const [count, setCount] = useState(0);
  const t = useT();

  return (
    <section className="counter">
      <p className="card__eyebrow">Try HMR</p>
      <div className="counter__row">
        <p className="counter__caption">
          Edit <code>src/App.tsx</code> and save — Vite reloads the catalog without losing state.
        </p>
        <button type="button" className="counter__btn" onClick={() => setCount((c) => c + 1)}>
          {t('{count, plural, one {Clicked 1 time} other {Clicked # times}}', { count })}
        </button>
      </div>
    </section>
  );
}
