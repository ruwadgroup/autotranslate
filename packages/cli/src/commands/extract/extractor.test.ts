import { canonicalKey, sourceKey } from '@autotranslate/core';
import { describe, expect, it } from 'vitest';
import { transformAutoWrap } from '../../auto-transform';
import { extractFile } from './extractor';

const FILE = 'src/Component.tsx';

describe('extractFile', () => {
  it('extracts <T> children as a structured tree', () => {
    const { messages } = extractFile(
      FILE,
      `
import { T } from '@autotranslate/react';
export function C() { return <T>Sign out</T>; }
      `,
    );
    const keys = Object.keys(messages);
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^t\./);
    expect(messages[keys[0] as string]).toEqual([{ type: 'text', value: 'Sign out' }]);
  });

  it('extracts <Var> slots', () => {
    const { messages } = extractFile(
      FILE,
      `
import { T, Var } from '@autotranslate/react';
export function C({ name }) {
  return <T>Hello, <Var name="name">{name}</Var>!</T>;
}
      `,
    );
    const tree = Object.values(messages)[0];
    expect(tree).toEqual([
      { type: 'text', value: 'Hello, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '!' },
    ]);
  });

  it('extracts <Plural> arms', () => {
    const { messages } = extractFile(
      FILE,
      `
import { T, Plural } from '@autotranslate/react';
export function C({ count }) {
  return <T><Plural value={count} one="1 item" other="# items" /></T>;
}
      `,
    );
    const tree = Object.values(messages)[0];
    expect(tree).toEqual([
      {
        type: 'plural',
        name: 'count',
        forms: {
          one: [{ type: 'text', value: '1 item' }],
          other: [{ type: 'text', value: '# items' }],
        },
      },
    ]);
  });

  it('extracts useT string-literal calls', () => {
    const { messages, manifest } = extractFile(
      FILE,
      `
import { useT } from '@autotranslate/react';
export function C() {
  const t = useT();
  return <button>{t('Sign out')}</button>;
}
      `,
    );
    expect(messages[sourceKey('Sign out')]).toBe('Sign out');
    expect(manifest[sourceKey('Sign out')]?.occurrences?.[0]?.file).toBe(FILE);
  });

  it('only follows variables actually bound to useT()', () => {
    const { messages } = extractFile(
      FILE,
      `
function notT(v: string) { return v; }
const t = notT;
export function C() { return <span>{t('Skipped')}</span>; }
      `,
    );
    expect(messages).toEqual({});
  });

  it('extracts standalone t() imports from @autotranslate/core/t', () => {
    const { messages } = extractFile(
      FILE,
      `
import { t } from '@autotranslate/core/t';
export function validate() { return t('Password is required'); }
      `,
    );
    expect(messages[sourceKey('Password is required')]).toBe('Password is required');
  });

  it('extracts standalone t() imports from @autotranslate/core/standalone', () => {
    const { messages } = extractFile(
      FILE,
      `
import { t } from '@autotranslate/core/standalone';
export function validate() { return t('Required field'); }
      `,
    );
    expect(messages[sourceKey('Required field')]).toBe('Required field');
  });

  it('respects local aliasing of standalone t', () => {
    const { messages } = extractFile(
      FILE,
      `
import { t as tt } from '@autotranslate/core/t';
export function validate() { return tt('Aliased message'); }
      `,
    );
    expect(messages[sourceKey('Aliased message')]).toBe('Aliased message');
  });

  it('captures context and description JSX attributes into manifest', () => {
    const { manifest } = extractFile(
      FILE,
      `
import { T } from '@autotranslate/react';
export function C() {
  return <T context="navbar" description="The sign-out button">Sign out</T>;
}
      `,
    );
    const meta = Object.values(manifest)[0];
    expect(meta?.context).toBe('navbar');
    expect(meta?.description).toBe('The sign-out button');
  });

  it('produces identical keys when only line breaks differ (matching JSX runtime)', () => {
    // React's JSX runtime collapses a newline + indentation between content
    // to a single space. Both forms below render `'Hello world'` at runtime.
    const a = extractFile(
      FILE,
      `import { T } from '@autotranslate/react'; const x = <T>Hello world</T>;`,
    );
    const b = extractFile(
      FILE,
      `import { T } from '@autotranslate/react';
const x = (
  <T>
    Hello
    world
  </T>
);`,
    );
    expect(Object.keys(a.messages)[0]).toBe(Object.keys(b.messages)[0]);
  });

  it('preserves internal multi-space (matching JSX runtime)', () => {
    // `<T>Hello   world</T>` keeps the three spaces literally at runtime,
    // so the extractor must too — different whitespace, different key.
    const a = extractFile(
      FILE,
      `import { T } from '@autotranslate/react'; const x = <T>Hello world</T>;`,
    );
    const b = extractFile(
      FILE,
      `import { T } from '@autotranslate/react'; const x = <T>Hello   world</T>;`,
    );
    expect(Object.keys(a.messages)[0]).not.toBe(Object.keys(b.messages)[0]);
  });

  it('matches React JSX whitespace rules — text lines between elements have no implicit padding', () => {
    // React's JSX runtime turns the trailing `\n  .\n` into '.', not ' . '.
    // The extractor must agree so the canonical key matches at runtime.
    const { messages } = extractFile(
      FILE,
      `
import { T, Var } from '@autotranslate/react';
const x = (
  <T>
    Hello, <Var name="name">{n}</Var>
    .
  </T>
);
      `,
    );
    const tree = Object.values(messages)[0];
    expect(tree).toEqual([
      { type: 'text', value: 'Hello, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '.' },
    ]);
  });

  it('walks tag wrappers inside <T>', () => {
    const { messages } = extractFile(
      FILE,
      `import { T } from '@autotranslate/react'; const x = <T>See <a href="/docs">docs</a></T>;`,
    );
    const tree = Object.values(messages)[0];
    expect(tree).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'tag', tag: 'a', children: [{ type: 'text', value: 'docs' }] },
    ]);
  });

  it('extracts <Branch> cases and the children fallback', () => {
    const { messages } = extractFile(
      FILE,
      `import { T, Branch } from '@autotranslate/react';
const x = <T><Branch branch={status} pending={<>Pending review</>} shipped={<>Shipped</>}>Status unknown</Branch></T>;`,
    );
    const tree = Object.values(messages)[0];
    expect(tree).toEqual([
      {
        type: 'branch',
        name: 'branch',
        cases: {
          default: [{ type: 'text', value: 'Status unknown' }],
          pending: [{ type: 'text', value: 'Pending review' }],
          shipped: [{ type: 'text', value: 'Shipped' }],
        },
      },
    ]);
  });

  it('extracts formatter components as auto-named var nodes', () => {
    const { messages } = extractFile(
      FILE,
      `import { T, Num, Currency, DateTime } from '@autotranslate/react';
const x = <T>You bought <Num>{qty}</Num> for <Currency currency="USD">{price}</Currency> on <DateTime>{when}</DateTime>.</T>;`,
    );
    const tree = Object.values(messages)[0];
    expect(tree).toEqual([
      { type: 'text', value: 'You bought ' },
      { type: 'var', name: 'num_0' },
      { type: 'text', value: ' for ' },
      { type: 'var', name: 'currency_0' },
      { type: 'text', value: ' on ' },
      { type: 'var', name: 'dt_0' },
      { type: 'text', value: '.' },
    ]);
  });

  it('produces distinct keys for <T> with different context props', () => {
    const a = extractFile(
      FILE,
      `import { T } from '@autotranslate/react'; const x = <T>Submit</T>;`,
    );
    const b = extractFile(
      FILE,
      `import { T } from '@autotranslate/react'; const x = <T context="navbar">Submit</T>;`,
    );
    const keyA = Object.keys(a.messages)[0];
    const keyB = Object.keys(b.messages)[0];
    expect(keyA).not.toBe(keyB);
  });

  it('captures maxChars and disambiguates t() by $context', () => {
    const { messages, manifest } = extractFile(
      FILE,
      `
import { useT } from '@autotranslate/react';
export function C() {
  const t = useT();
  return (
    <>
      <button>{t('Submit', { $context: 'navbar', $maxChars: 12 })}</button>
      <span>{t('Submit')}</span>
    </>
  );
}
      `,
    );
    expect(messages[sourceKey('Submit')]).toBe('Submit');
    expect(messages[sourceKey('Submit', 'navbar')]).toBe('Submit');
    expect(manifest[sourceKey('Submit', 'navbar')]?.context).toBe('navbar');
    expect(manifest[sourceKey('Submit', 'navbar')]?.maxChars).toBe(12);
  });
});

describe('extractFile - static string resolution', () => {
  it('extracts t(KEY) when KEY is a same-file const string literal', () => {
    const { messages } = extractFile(
      FILE,
      `
import { t } from '@autotranslate/core/t';
const KEY = 'Same-file const label';
export function label() { return t(KEY); }
      `,
    );
    expect(messages[sourceKey('Same-file const label')]).toBe('Same-file const label');
  });

  it('extracts expressionless template literals', () => {
    const { messages } = extractFile(
      FILE,
      `
import { t } from '@autotranslate/core/t';
export function label() { return t(\`Template label\`); }
      `,
    );
    expect(messages[sourceKey('Template label')]).toBe('Template label');
  });

  it('does not extract reassigned bindings or dynamic values', () => {
    const { messages } = extractFile(
      FILE,
      `
import { t } from '@autotranslate/core/t';
let mutable = 'First';
mutable = 'Second';
export function label(x: string) { return t(mutable) + t(x) + t(\`joined \${x}\`); }
      `,
    );
    expect(Object.keys(messages)).toHaveLength(0);
  });
});

describe('extractFile - auto copy fields', () => {
  const keyFor = (value: string) => canonicalKey([{ type: 'text', value }]);

  it('extracts static custom-component props and config object fields in auto mode', () => {
    const { messages } = extractFile(
      FILE,
      `
const views = [
  { value: 'month', label: 'Monthly' as const },
  { value: 'week', label: 'Weekly' },
];
const columns = [{ accessorKey: 'relationship', header: 'Relationship' }];
const copy = {
  noun: { customer: { singular: 'Customer', plural: 'Customers', verb: 'Add a customer' } },
  customer: { createCta: 'Add a customer', primaryCTA: 'Create customer' },
};
const emptyTitle = 'Nothing scheduled';
export function Screen() {
  return <SettingsSection title="Email Address" description={'Contact support to change it.'} />;
}
      `,
      { includeAutoCopy: true },
    );

    for (const value of [
      'Monthly',
      'Weekly',
      'Relationship',
      'Customer',
      'Customers',
      'Add a customer',
      'Create customer',
      'Nothing scheduled',
      'Email Address',
      'Contact support to change it.',
    ]) {
      expect(messages[keyFor(value)]).toEqual([{ type: 'text', value }]);
    }
  });

  it.each([
    ['tailwind-variants', 'tv', 'makeVariants'],
    ['class-variance-authority', 'cva', 'makeVariants'],
  ])('ignores semantic slot names inside styling calls from %s', (source, imported, local) => {
    const { messages } = extractFile(
      FILE,
      `
import { ${imported} as ${local} } from '${source}';
const styles = ${local}({
  slots: {
    header: 'flex px-6',
    title: 'text-sm',
    description: 'text-muted-foreground',
  },
  variants: {
    compact: { true: { header: 'gap-1 py-2' } },
  },
});
const columns = [{ accessorKey: 'relationship', header: 'Relationship' }];
      `,
      { includeAutoCopy: true },
    );

    expect(messages[keyFor('Relationship')]).toEqual([{ type: 'text', value: 'Relationship' }]);
    for (const structural of ['flex px-6', 'text-sm', 'text-muted-foreground', 'gap-1 py-2']) {
      expect(messages[keyFor(structural)], structural).toBeUndefined();
    }
  });

  it.each([
    'className',
    'classNames',
    'classes',
    'styles',
  ])('ignores semantic fields nested in the JSX %s styling prop', (prop) => {
    const { messages } = extractFile(
      FILE,
      `
const card = (
  <Card
    ${prop}={{
      header: 'px-5 pt-5 pb-3',
      nested: { title: 'text-sm', description: 'text-muted-foreground' },
    }}
    title="Customer details"
  />
);
const columns = [{ accessorKey: 'relationship', header: 'Relationship' }];
        `,
      { includeAutoCopy: true },
    );

    expect(messages[keyFor('Customer details')]).toBeDefined();
    expect(messages[keyFor('Relationship')]).toBeDefined();
    for (const structural of ['px-5 pt-5 pb-3', 'text-sm', 'text-muted-foreground']) {
      expect(messages[keyFor(structural)], structural).toBeUndefined();
    }
  });

  it('does not extract structural fields or intrinsic DOM attributes', () => {
    const { messages } = extractFile(
      FILE,
      `
const view = { value: 'month', id: 'calendar-month', href: '/month', label: 'Monthly' };
const input = <input title="Native title" placeholder="Search" />;
const skipped = <Card data-no-translate title="Secret title" />;
const translated = <T description="Translator note">Visible copy</T>;
      `,
      { includeAutoCopy: true },
    );

    expect(messages[keyFor('Monthly')]).toBeDefined();
    expect(messages[keyFor('month')]).toBeUndefined();
    expect(messages[keyFor('calendar-month')]).toBeUndefined();
    expect(messages[keyFor('/month')]).toBeUndefined();
    expect(messages[keyFor('Native title')]).toBeUndefined();
    expect(messages[keyFor('Search')]).toBeUndefined();
    expect(messages[keyFor('Secret title')]).toBeUndefined();
    expect(messages[keyFor('Translator note')]).toBeUndefined();
  });

  it('leaves explicit mode unchanged', () => {
    const { messages } = extractFile(
      FILE,
      `const config = { label: 'Monthly' }; const x = <Card title="Email Address" />;`,
    );
    expect(messages).toEqual({});
  });

  it('extracts auto-injected attribute t() calls with the same key as hand-written useT', () => {
    // In auto mode the extractor sees the transformed source. A host-element
    // copy attribute becomes `attr={t("…")}`, which must extract to the exact
    // source key a hand-written `t("Search cases")` would produce.
    const client = [
      "'use client';",
      'export function SearchBar() {',
      '  return <input placeholder="Search cases" />;',
      '}',
      '',
    ].join('\n');
    const transformed = transformAutoWrap(client, { filename: FILE }).code;
    const { messages } = extractFile(FILE, transformed, { includeAutoCopy: true });

    const key = sourceKey('Search cases');
    expect(messages[key]).toBe('Search cases');
    expect(Object.keys(messages)).toEqual([key]);
  });

  it('extracts copy attributes but never structural host attributes', () => {
    const client = [
      "'use client';",
      'export function Gauge() {',
      '  return <svg aria-label="Risk gauge" viewBox="0 0 220 126" role="img" aria-live="polite" fill="var(--foreground)" strokeLinecap="round" vectorEffect="none"><title>Gauge</title></svg>;',
      '}',
      '',
    ].join('\n');
    const transformed = transformAutoWrap(client, { filename: FILE }).code;
    const { messages } = extractFile(FILE, transformed, { includeAutoCopy: true });

    expect(messages[sourceKey('Risk gauge')]).toBe('Risk gauge');
    expect(messages[canonicalKey([{ type: 'text', value: 'Gauge' }])]).toEqual([
      { type: 'text', value: 'Gauge' },
    ]);
    for (const structural of [
      '0 0 220 126',
      'img',
      'polite',
      'var(--foreground)',
      'round',
      'none',
    ]) {
      expect(messages[sourceKey(structural)], structural).toBeUndefined();
    }
  });
});

describe('extractFile - JSX composition props', () => {
  it('extracts action copy nested in a JSX-valued prop', () => {
    const client = [
      "'use client';",
      'export function Screen() {',
      '  return <ListPage actions={<div><Button><Download /> Export</Button></div>} />;',
      '}',
      '',
    ].join('\n');
    const transformed = transformAutoWrap(client, { filename: FILE }).code;
    const { messages, manifest } = extractFile(FILE, transformed, { includeAutoCopy: true });
    const key = canonicalKey([
      { type: 'tag', tag: 'Download', children: [] },
      { type: 'text', value: ' Export' },
    ]);

    expect(messages[key]).toEqual([
      { type: 'tag', tag: 'Download', children: [] },
      { type: 'text', value: ' Export' },
    ]);
    expect(manifest[key]?.occurrences).toEqual([{ file: FILE, line: 4 }]);
  });
});
