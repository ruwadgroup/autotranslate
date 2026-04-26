'use client';

import { useT } from '@autotranslate/react';
import { useRouter } from 'next/navigation';

interface LocaleSwitcherProps {
  readonly current: string;
  readonly locales: ReadonlyArray<string>;
}

export default function LocaleSwitcher({ current, locales }: LocaleSwitcherProps) {
  const t = useT();
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      {t('Language')}
      <select
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        value={current}
        aria-label={t('Language')}
        onChange={(event) => {
          const next = event.target.value;
          // Default locale uses the bare URL; other locales use a /<lang> prefix.
          router.push(next === 'en' ? '/' : `/${next}`);
        }}
      >
        {locales.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
    </label>
  );
}
