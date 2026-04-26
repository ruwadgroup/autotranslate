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

  it('produces canonically identical keys for whitespace variants', () => {
    const a = extractFile(
      FILE,
      `import { T } from '@autotranslate/react'; const x = <T>Hello world</T>;`,
    );
    const b = extractFile(
      FILE,
      `import { T } from '@autotranslate/react';
const x = <T>Hello   world</T>;`,
    );
    expect(Object.keys(a.messages)[0]).toBe(Object.keys(b.messages)[0]);
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
});
