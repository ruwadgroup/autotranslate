import { Branch, Currency, DateTime, Num, RelativeTime, T } from '@autotranslate/react';

interface StatsCardProps {
  readonly status: 'pending' | 'shipped' | 'delivered';
  readonly visitors: number;
  readonly revenue: number;
  readonly lastUpdated: Date;
  readonly nextRelease: Date;
}

/**
 * Demonstrates v0.2 additions: `<Branch>` discriminator, `<Num>` /
 * `<Currency>` / `<DateTime>` / `<RelativeTime>` formatters, and `<T>` with
 * a `context` hint. Every value is locale-aware via `Intl`.
 */
export default function StatsCard({
  status,
  visitors,
  revenue,
  lastUpdated,
  nextRelease,
}: StatsCardProps) {
  return (
    <section className="grid w-full max-w-xl gap-3 rounded-2xl border border-zinc-200 bg-white/60 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60">
      <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
        <T>Live stats</T>
      </p>

      <p className="text-base text-zinc-900 dark:text-zinc-100">
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

      <p className="text-base text-zinc-900 dark:text-zinc-100">
        <T>
          Revenue: <Currency value={revenue} currency="USD" />. Last updated{' '}
          <RelativeTime value={lastUpdated} />.
        </T>
      </p>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        <T>
          Next release on{' '}
          <DateTime
            value={nextRelease}
            options={{
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }}
          />
          .
        </T>
      </p>

      <div className="flex items-center justify-end gap-2 pt-1 text-xs">
        <T context="navbar action">Submit</T>
        <span className="text-zinc-400">·</span>
        <T context="form button">Submit</T>
      </div>
    </section>
  );
}
