import { describe, expect, it } from 'vitest';
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
    expect(messages['Sign out']).toBe('Sign out');
    expect(manifest['Sign out']?.occurrences?.[0]?.file).toBe(FILE);
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
    expect(messages.Submit).toBe('Submit');
    expect(messages['Submit@@navbar']).toBe('Submit');
    expect(manifest['Submit@@navbar']?.context).toBe('navbar');
    expect(manifest['Submit@@navbar']?.maxChars).toBe(12);
  });
});
