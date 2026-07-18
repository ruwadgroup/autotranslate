import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-untranslated-jsx';

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

describe('no-untranslated-jsx', () => {
  it('runs the rule against fixtures', () => {
    tester.run('no-untranslated-jsx', rule, {
      valid: [
        // Wrapped in <T>
        { code: 'const x = <T>Hello</T>;' },
        // Marker descendants
        { code: 'const x = <T>Hello, <Var>{name}</Var>!</T>;' },
        { code: 'const x = <T><Plural value={n} other="# items" /></T>;' },
        // Whitespace-only text
        { code: 'const x = <div>{"   "}</div>;' },
        { code: 'const x = <div>\n  </div>;' },
        // Allowlisted attributes
        { code: 'const x = <div className="foo" />;' },
        { code: 'const x = <a href="/docs" />;' },
        { code: 'const x = <input type="text" name="email" />;' },
        {
          code: 'const x = <svg viewBox="0 0 10 10" fill="none" role="img" aria-live="polite" />;',
        },
        { code: 'const x = <input accept=".csv,text/csv" unknownToken="keep-me" />;' },
        // Numeric / bool children
        { code: 'const x = <div>{42}</div>;' },
        { code: 'const x = <div>{true}</div>;' },
        // Dynamic data is not assumed to be interface copy.
        { code: 'const x = <div>{user.name}</div>;' },
        // Explicit dynamic-source lookup.
        { code: 'const x = <T>{title}</T>;' },
      ],
      invalid: [
        {
          code: 'const x = <p>Hello</p>;',
          errors: [{ messageId: 'bareText' }],
        },
        {
          code: 'const x = <span>{"Hello"}</span>;',
          errors: [{ messageId: 'bareText' }],
        },
        {
          code: 'const x = <button title="Save">x</button>;',
          errors: [{ messageId: 'bareAttribute' }, { messageId: 'bareText' }],
        },
        {
          code: 'const x = <img alt="Customer portrait" />;',
          errors: [{ messageId: 'bareAttribute' }],
        },
        {
          code: 'const x = <h2>{title}</h2>;',
          errors: [{ messageId: 'dynamicCopy' }],
        },
        {
          code: 'const x = <button>{view.label}</button>;',
          errors: [{ messageId: 'dynamicCopy' }],
        },
      ],
    });
  });

  it('suppresses host-element attribute warnings the auto compiler handles (client)', () => {
    tester.run('no-untranslated-jsx', rule, {
      valid: [
        // Host-element copy attribute in a client module — the auto compiler
        // rewrites it, so the rule must stay quiet.
        {
          code: '"use client";\nconst x = <input placeholder="Search" />;',
          options: [{ autoMode: true }],
        },
        {
          code: '"use client";\nconst x = <button aria-label="Close" />;',
          options: [{ autoMode: true }],
        },
      ],
      invalid: [
        // Server module (no "use client"): the compiler does NOT handle it.
        {
          code: 'const x = <input placeholder="Search" />;',
          options: [{ autoMode: true }],
          errors: [{ messageId: 'bareAttribute' }],
        },
        // Custom component: still the component's own responsibility.
        {
          code: '"use client";\nconst x = <Field placeholder="Search" />;',
          options: [{ autoMode: true }],
          errors: [{ messageId: 'bareAttribute' }],
        },
        // Without the option the rule flags host attributes as before.
        {
          code: '"use client";\nconst x = <input placeholder="Search" />;',
          errors: [{ messageId: 'bareAttribute' }],
        },
      ],
    });
  });
});
