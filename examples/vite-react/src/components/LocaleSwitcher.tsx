import { useT } from '@autotranslate/react';
import { useId } from 'react';

interface LocaleSwitcherProps {
  readonly current: string;
  readonly locales: ReadonlyArray<string>;
  readonly onChange: (locale: string) => void;
}

const NATIVE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ja: '日本語',
};

export default function LocaleSwitcher({ current, locales, onChange }: LocaleSwitcherProps) {
  const t = useT();
  const groupName = useId();

  return (
    <fieldset className="switcher">
      <legend className="switcher__legend">{t('Language')}</legend>
      {locales.map((locale) => {
        const id = `${groupName}-${locale}`;
        return (
          <div key={locale} className="switcher__option">
            <input
              type="radio"
              id={id}
              name={groupName}
              value={locale}
              checked={locale === current}
              onChange={() => onChange(locale)}
              className="switcher__input"
            />
            <label htmlFor={id} className="switcher__label">
              <span>{NATIVE_NAMES[locale] ?? locale}</span>
              <span className="switcher__tag">{locale}</span>
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
