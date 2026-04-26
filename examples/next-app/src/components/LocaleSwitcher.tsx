'use client';

import { useT } from '@autotranslate/react';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useTransition } from 'react';

interface LocaleSwitcherProps {
  readonly current: string;
  readonly locales: ReadonlyArray<string>;
}

/**
 * Native-name labels — show each language in its own script. Universal
 * convention for locale switchers because users recognize their language
 * instantly without needing to read a foreign tag.
 */
const NATIVE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ja: '日本語',
};

export default function LocaleSwitcher({ current, locales }: LocaleSwitcherProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const groupName = useId();

  const switchTo = (locale: string) => {
    // Strip the current `/<lang>` prefix and prepend the new one so we stay
    // on the same page when switching languages instead of jumping home.
    const stripped = pathname.replace(new RegExp(`^/${current}(?=/|$)`), '');
    const next = `/${locale}${stripped || ''}`;
    startTransition(() => router.push(next));
  };

  return (
    <fieldset
      className="inline-flex rounded-full border border-zinc-200 bg-white p-1 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      disabled={pending}
    >
      <legend className="sr-only">{t('Language')}</legend>
      {locales.map((locale) => {
        const active = locale === current;
        const id = `${groupName}-${locale}`;
        return (
          <div key={locale}>
            <input
              type="radio"
              id={id}
              name={groupName}
              value={locale}
              checked={active}
              onChange={() => switchTo(locale)}
              className="peer sr-only"
            />
            <label
              htmlFor={id}
              className="cursor-pointer rounded-full px-3 py-1.5 transition-colors text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 peer-checked:bg-zinc-900 peer-checked:text-zinc-50 peer-checked:cursor-default peer-disabled:cursor-default peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 dark:peer-checked:bg-zinc-50 dark:peer-checked:text-zinc-900 dark:peer-focus-visible:outline-zinc-50"
            >
              <span className="font-medium">{NATIVE_NAMES[locale] ?? locale}</span>
              <span className="ml-2 text-xs uppercase tracking-wider opacity-60">{locale}</span>
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
