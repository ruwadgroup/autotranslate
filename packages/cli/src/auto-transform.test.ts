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

describe('transformAutoWrap - attributes', () => {
  it('rewrites host copy attributes and injects useT in a client component', () => {
    const result = run(
      [
        "'use client';",
        'export function SearchBar() {',
        '  return <input placeholder="Search cases" aria-label="Search" />;',
        '}',
        '',
      ].join('\n'),
    );
    expect(result.changed).toBe(true);
    expect(result.code).toBe(
      [
        "'use client';",
        "import { useT } from '@autotranslate/react';",
        'export function SearchBar() {',
        '  const t = useT();',
        '  return <input placeholder={t("Search cases")} aria-label={t("Search")} />;',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('reuses an existing useT binding instead of injecting a second', () => {
    const result = run(
      [
        "'use client';",
        "import { useT } from '@autotranslate/react';",
        'export function Row() {',
        '  const tr = useT();',
        '  return <button title="Delete customer">{tr(\'X\')}</button>;',
        '}',
        '',
      ].join('\n'),
    );
    expect(result.code).toBe(
      [
        "'use client';",
        "import { useT } from '@autotranslate/react';",
        'export function Row() {',
        '  const tr = useT();',
        '  return <button title={tr("Delete customer")}>{tr(\'X\')}</button>;',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('injects once at component scope and references it from a nested closure', () => {
    const result = run(
      [
        "'use client';",
        'export function List({ items }) {',
        '  return items.map((it) => <input key={it.id} placeholder="Filter" />);',
        '}',
        '',
      ].join('\n'),
    );
    expect(result.code).toBe(
      [
        "'use client';",
        "import { useT } from '@autotranslate/react';",
        'export function List({ items }) {',
        '  const t = useT();',
        '  return items.map((it) => <input key={it.id} placeholder={t("Filter")} />);',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('merges useT into an existing @autotranslate/react import and adds T for text', () => {
    const result = run(
      [
        "'use client';",
        "import { Var } from '@autotranslate/react';",
        'export function A() {',
        '  return <button title="Save now">Save</button>;',
        '}',
        '',
      ].join('\n'),
    );
    expect(result.code).toBe(
      [
        "'use client';",
        "import { Var, T, useT } from '@autotranslate/react';",
        'export function A() {',
        '  const t = useT();',
        '  return <button title={t("Save now")}><T>Save</T></button>;',
        '}',
        '',
      ].join('\n'),
    );
  });

  it('falls back to a non-conflicting binding name when `t` is taken', () => {
    const result = run(
      [
        "'use client';",
        'export function A({ t }) {',
        '  return <input placeholder="Search" title="Filter" />;',
        '}',
        '',
      ].join('\n'),
    );
    expect(result.code).toContain('const __t = useT();');
    expect(result.code).toContain('placeholder={__t("Search")}');
    expect(result.code).toContain('title={__t("Filter")}');
  });

  it('leaves server-component attributes untouched (no "use client")', () => {
    const source = [
      'export function Server() {',
      '  return <input placeholder="Search cases" />;',
      '}',
      '',
    ].join('\n');
    expect(run(source).code).toBe(source);
  });

  it('does not inject on custom-component copy props', () => {
    const source = [
      "'use client';",
      'export function Form() {',
      '  return <Field placeholder="Search cases" />;',
      '}',
      '',
    ].join('\n');
    expect(run(source).code).toBe(source);
  });

  it('leaves structural and unknown attributes as literals', () => {
    const result = run(
      [
        "'use client';",
        'export function A() {',
        '  return <svg viewBox="0 0 220 126" role="img" aria-live="polite" fill="var(--foreground)" stroke="none" strokeLinecap="round" textAnchor="middle" vectorEffect="none" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg" data-id="z"><path d="M0 0" unknownToken="keep-me" /></svg>;',
        '}',
        '',
      ].join('\n'),
    );
    expect(result.changed).toBe(false);
  });

  it('rewrites the full positive copy-attribute set', () => {
    const result = run(
      [
        "'use client';",
        'export function A() {',
        '  return <img title="Profile" placeholder="Search" alt="Customer portrait" label="Customer" aria-label="Open profile" aria-description="Customer details" aria-placeholder="Search customers" aria-roledescription="Customer card" aria-valuetext="High risk" />;',
        '}',
        '',
      ].join('\n'),
    );
    for (const value of [
      'Profile',
      'Search',
      'Customer portrait',
      'Customer',
      'Open profile',
      'Customer details',
      'Search customers',
      'Customer card',
      'High risk',
    ]) {
      expect(result.code).toContain(`t("${value}")`);
    }
  });

  it('leaves form-control tokens and numeric geometry untouched', () => {
    const source = [
      "'use client';",
      'export function A() {',
      '  return <input accept=".csv,text/csv" autoComplete="off" inputMode="numeric" value="100" min="0" max="100" step="5" />;',
      '}',
      '',
    ].join('\n');
    expect(run(source)).toEqual({ code: source, changed: false });
  });

  it('respects data-no-translate on the element', () => {
    const source = [
      "'use client';",
      'export function A() {',
      '  return <input data-no-translate placeholder="Search" />;',
      '}',
      '',
    ].join('\n');
    expect(run(source).code).toBe(source);
  });

  it('respects data-no-translate on an ancestor', () => {
    const source = [
      "'use client';",
      'export function A() {',
      '  return <div data-no-translate><input placeholder="Search" /></div>;',
      '}',
      '',
    ].join('\n');
    expect(run(source).code).toBe(source);
  });

  it('leaves dynamic/template attribute values alone', () => {
    // Build the template-literal source without a literal `${` in this string.
    const tmpl = ['aria-label={`Hi ', '{label}`}'].join('$');
    const source = [
      "'use client';",
      'export function A({ label }) {',
      `  return <input placeholder={label} ${tmpl} />;`,
      '}',
      '',
    ].join('\n');
    expect(run(source).code).toBe(source);
  });

  it('does not inject when there is no enclosing component/hook function', () => {
    const source = [
      "'use client';",
      'export const node = <input placeholder="Search" />;',
      '',
    ].join('\n');
    expect(run(source).code).toBe(source);
  });

  it('skips skip-elements (style/script) attributes', () => {
    const source = [
      "'use client';",
      'export function A() {',
      '  return <style title="x">{".a{}"}</style>;',
      '}',
      '',
    ].join('\n');
    expect(run(source).code).toBe(source);
  });
});
