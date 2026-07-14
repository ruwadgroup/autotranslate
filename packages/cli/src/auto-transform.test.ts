import { afterEach, describe, expect, it, vi } from 'vitest';
import { transformAutoWrap } from './auto-transform';

const run = (source: string, filename = 'Component.tsx') => transformAutoWrap(source, { filename });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('transformAutoWrap', () => {
  it('wraps a text run and vars the dynamic expression (arch.md section 6)', () => {
    const result = run(
      [
        'export function Greeting({ user }) {',
        '  return <p>Hello {user.name}, welcome</p>;',
        '}',
        '',
      ].join('\n'),
    );

    expect(result.changed).toBe(true);
    expect(result.code).toBe(
      [
        "import { T, Var } from '@autotranslate/react';",
        'export function Greeting({ user }) {',
        '  return <p><T>Hello <Var>{user.name}</Var>, welcome</T></p>;',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('inserts generated imports after module directives', () => {
    const source = [
      "'use client';",
      "'use strict';",
      'export function Greeting() {',
      '  return <p>Hello world</p>;',
      '}',
      '',
    ].join('\n');

    const result = run(source);

    expect(result.changed).toBe(true);
    expect(result.code).toBe(
      [
        "'use client';",
        "'use strict';",
        "import { T } from '@autotranslate/react';",
        'export function Greeting() {',
        '  return <p><T>Hello world</T></p>;',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('leaves data-no-translate on self unchanged', () => {
    const source = 'const x = <p data-no-translate>SKU-{id}</p>;';
    expect(run(source)).toEqual({ code: source, changed: false });
  });

  it('leaves data-no-translate on an ancestor unchanged', () => {
    const source = 'const x = <div data-no-translate><p>Secret {token}</p></div>;';
    expect(run(source)).toEqual({ code: source, changed: false });
  });

  it('leaves content already inside a marker (<T>/<Var>) unchanged', () => {
    const source = 'const x = <T>Hello <Var>{user.name}</Var> there</T>;';
    expect(run(source)).toEqual({ code: source, changed: false });
  });

  it('skips <code> and <pre> content', () => {
    const source = 'const x = <code>npm install autotranslate</code>;';
    expect(run(source)).toEqual({ code: source, changed: false });

    const nested = run('const x = <p>Run <code>npm i</code> now</p>;');
    expect(nested.code).toBe(
      "import { T } from '@autotranslate/react';\nconst x = <p><T>Run </T><code>npm i</code><T> now</T></p>;",
    );
  });

  it('keeps a sentence with a clean inline element as ONE T (word order survives)', () => {
    const result = run('const x = <p>Hi <strong>there</strong> friend</p>;');
    expect(result.code).toBe(
      "import { T } from '@autotranslate/react';\nconst x = <p><T>Hi <strong>there</strong> friend</T></p>;",
    );
  });

  it('preserves custom component tag names for runtime serialization', () => {
    const result = run('const x = <p>See <Link href="/docs">docs</Link></p>;');
    expect(result.code).toBe(
      'import { T } from \'@autotranslate/react\';\nconst x = <p><T>See <Link data-autotranslate-tag="Link" href="/docs">docs</Link></T></p>;',
    );
  });

  it('includes a leading clean element in the run when the level has direct text', () => {
    const result = run('const x = <p><strong>Bold</strong> rest</p>;');
    expect(result.code).toBe(
      "import { T } from '@autotranslate/react';\nconst x = <p><T><strong>Bold</strong> rest</T></p>;",
    );
  });

  it('recurses into block containers instead of merging separate copy blocks', () => {
    const result = run('const x = <div><h1>Title</h1><p>Body</p></div>;');
    expect(result.code).toBe(
      "import { T } from '@autotranslate/react';\nconst x = <div><h1><T>Title</T></h1><p><T>Body</T></p></div>;",
    );
  });

  it('splits the run around a mid-sentence data-no-translate element', () => {
    const result = run('const x = <p>Total <span data-no-translate>SKU-{id}</span> due today</p>;');
    expect(result.code).toBe(
      "import { T } from '@autotranslate/react';\nconst x = <p><T>Total </T><span data-no-translate>SKU-{id}</span><T> due today</T></p>;",
    );
  });

  it('wraps dynamic expressions inside clean child elements as <Var>', () => {
    const result = run('const x = <p>Hi <strong>there {name}</strong> friend</p>;');
    expect(result.code).toBe(
      "import { T, Var } from '@autotranslate/react';\nconst x = <p><T>Hi <strong>there <Var>{name}</Var></strong> friend</T></p>;",
    );
  });

  it('merges T/Var into an existing @autotranslate/react import', () => {
    const source = [
      "import { useT } from '@autotranslate/react';",
      'export function C() {',
      '  const t = useT();',
      '  return <p>Hello {name}</p>;',
      '}',
      '',
    ].join('\n');

    const result = run(source);
    expect(result.changed).toBe(true);
    expect(result.code).toBe(
      [
        "import { useT, T, Var } from '@autotranslate/react';",
        'export function C() {',
        '  const t = useT();',
        '  return <p><T>Hello <Var>{name}</Var></T></p>;',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('does not duplicate an already-imported T when no Var is needed', () => {
    const source = [
      "import { T } from '@autotranslate/react';",
      'const x = <p>Hello world</p>;',
    ].join('\n');

    const result = run(source);
    expect(result.code).toBe(
      ["import { T } from '@autotranslate/react';", 'const x = <p><T>Hello world</T></p>;'].join(
        '\n',
      ),
    );
    // T already present -> import line untouched (no second `import`).
    expect(result.code.match(/import/g)).toHaveLength(1);
  });

  it('STOPs (unchanged + warns) when T/Var names are already taken', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const source = ['const T = 1;', 'const x = <p>Hello world</p>;'].join('\n');

    const result = run(source, 'Taken.tsx');
    expect(result).toEqual({ code: source, changed: false });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Taken.tsx'));
  });

  it('fast-paths letterless / whitespace source without changing it', () => {
    // No `>`/`}` is followed by letters before the next `<`/`{`, so the regex
    // pre-filter rejects it and we never parse.
    expect(run('const b = 1 > 0;')).toEqual({ code: 'const b = 1 > 0;', changed: false });
    expect(run('   \n  ')).toEqual({ code: '   \n  ', changed: false });
  });

  it('leaves non-jsx filenames untouched', () => {
    const source = 'const x = <p>Hello world</p>;';
    expect(run(source, 'not-jsx.ts')).toEqual({ code: source, changed: false });
  });

  it('leaves JSX with no translatable text unchanged', () => {
    const source = 'const x = <p>{count}</p>;';
    expect(run(source)).toEqual({ code: source, changed: false });
  });

  it('wraps dynamic-only copy-bearing identifiers and member expressions', () => {
    const source = [
      'function Card({ title, description }) {',
      '  return <><h2>{title}</h2><p>{description}</p></>;',
      '}',
      'const item = <button>{view.label}</button>;',
    ].join('\n');

    expect(run(source).code).toBe(
      [
        "import { T } from '@autotranslate/react';",
        'function Card({ title, description }) {',
        '  return <><h2><T>{title}</T></h2><p><T>{description}</T></p></>;',
        '}',
        'const item = <button><T>{view.label}</T></button>;',
      ].join('\n'),
    );
  });

  it('does not wrap dynamic data fields or opted-out copy fields', () => {
    const source = [
      'const a = <span>{user.name}</span>;',
      'const b = <span data-no-translate>{item.title}</span>;',
    ].join('\n');
    expect(run(source)).toEqual({ code: source, changed: false });
  });

  it('keeps copy-bearing expressions as Var slots inside literal sentences', () => {
    expect(run('const x = <p>Selected: {view.label}</p>;').code).toBe(
      "import { T, Var } from '@autotranslate/react';\nconst x = <p><T>Selected: <Var>{view.label}</Var></T></p>;",
    );
  });

  it('parses files whose only copy signal is a dynamic expression', () => {
    expect(run('const x = <h2>{title}</h2>;').changed).toBe(true);
  });

  it('keeps untouched code byte-identical (only splices wrappers + import)', () => {
    const weird = 'const config = {a:1,   b:2,\n    c:3};';
    const source = `${weird}\nexport function C() { return <p>Hi {name}</p>; }\n`;

    const result = run(source);
    expect(result.changed).toBe(true);
    expect(result.code).toContain(weird);
    expect(result.code).toBe(
      [
        "import { T, Var } from '@autotranslate/react';",
        weird,
        'export function C() { return <p><T>Hi <Var>{name}</Var></T></p>; }',
        '',
      ].join('\n'),
    );
  });
});
