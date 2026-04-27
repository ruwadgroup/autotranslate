import { Branch, Currency, DateTime, Num, RelativeTime, T } from '@autotranslate/react';

interface StatsCardProps {
  readonly status: 'pending' | 'shipped' | 'delivered';
  readonly visitors: number;
  readonly revenue: number;
  readonly lastUpdated: Date;
  readonly nextRelease: Date;
}

export default function StatsCard({
  status,
  visitors,
  revenue,
  lastUpdated,
  nextRelease,
}: StatsCardProps) {
  return (
    <section className="card">
      <p className="card__eyebrow">
        <T>Live stats</T>
      </p>

      <p className="card__line">
        <T>
          <Num value={visitors} /> visitors today —{' '}
          <Branch
            branch={status}
            pending={<>order is pending review</>}
            shipped={<>order is on its way</>}
            delivered={<>order has been delivered</>}
          >
            order status is unknown
          </Branch>
          .
        </T>
      </p>

      <p className="card__line">
        <T>
          Revenue: <Currency value={revenue} currency="USD" />. Last updated{' '}
          <RelativeTime value={lastUpdated} />.
        </T>
      </p>

      <p className="card__line card__line--muted">
        <T>
          Next release on{' '}
          <DateTime
            value={nextRelease}
            options={{ weekday: 'long', month: 'short', day: 'numeric' }}
          />
          .
        </T>
      </p>

      <div className="card__contexts">
        <T context="navbar action">Submit</T>
        <span>·</span>
        <T context="form button">Submit</T>
      </div>
    </section>
  );
}
