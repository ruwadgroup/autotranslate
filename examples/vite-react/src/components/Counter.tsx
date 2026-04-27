import { Plural, T } from '@autotranslate/react';
import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <section className="counter">
      <p className="card__eyebrow">
        <T>Try HMR</T>
      </p>
      <div className="counter__row">
        <p className="counter__caption">
          <T>
            Edit <code>src/App.tsx</code> and save — Vite reloads the catalog without losing state.
          </T>
        </p>
        <button type="button" className="counter__btn" onClick={() => setCount((c) => c + 1)}>
          <T>
            Clicked <span className="counter__count">{count}</span>{' '}
            <Plural value={count} one="time" other="times" />
          </T>
        </button>
      </div>
    </section>
  );
}
