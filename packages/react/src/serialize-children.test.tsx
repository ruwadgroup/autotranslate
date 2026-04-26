import { describe, expect, it } from 'vitest';
import { Branch, Currency, DateTime, Num, Plural, RelativeTime, Var } from './markers';
import { serializeChildren } from './serialize-children';

describe('serializeChildren', () => {
  it('flattens text-only children to a single text node', () => {
    const { tree } = serializeChildren('Hello, world!');
    expect(tree).toEqual([{ type: 'text', value: 'Hello, world!' }]);
  });

  it('captures Var slots and their runtime children', () => {
    const { tree, varSlots } = serializeChildren(
      <>
        Hello, <Var name="name">Ada</Var>!
      </>,
    );
    expect(tree).toEqual([
      { type: 'text', value: 'Hello, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '!' },
    ]);
    expect(varSlots.get('name')).toBe('Ada');
  });

  it('defaults the Var name to "value"', () => {
    const { tree } = serializeChildren(<Var>Ada</Var>);
    expect(tree).toEqual([{ type: 'var', name: 'value' }]);
  });

  it('captures plural arms', () => {
    const { tree, pluralSlots } = serializeChildren(
      <Plural value={3} one="1 item" other="# items" />,
    );
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
    const slot = pluralSlots.get('count');
    expect(slot?.value).toBe(3);
    expect(slot?.forms.one).toBe('1 item');
  });

  it('walks HTML element children and tracks tag occurrences', () => {
    const { tree, tagSlots } = serializeChildren(
      <>
        See <a href="/docs">our docs</a> and <a href="/api">the API</a>.
      </>,
    );
    expect(tree).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'tag', tag: 'a', children: [{ type: 'text', value: 'our docs' }] },
      { type: 'text', value: ' and ' },
      { type: 'tag', tag: 'a', children: [{ type: 'text', value: 'the API' }] },
      { type: 'text', value: '.' },
    ]);
    expect(tagSlots.size).toBe(2);
    expect(tagSlots.get('a#0')?.props).toMatchObject({ href: '/docs' });
    expect(tagSlots.get('a#1')?.props).toMatchObject({ href: '/api' });
  });

  it('drops booleans and null/undefined siblings', () => {
    const { tree } = serializeChildren(
      <>
        Hello{null}
        {false}
        {undefined} world
      </>,
    );
    expect(tree).toEqual([{ type: 'text', value: 'Hello world' }]);
  });

  it('captures Branch cases and the default fallback', () => {
    const { tree, branchSlots } = serializeChildren(
      <Branch
        branch="shipped"
        pending={<>Pending</>}
        shipped={<>On its way</>}
        delivered={<>Arrived</>}
      >
        Unknown
      </Branch>,
    );
    expect(tree).toEqual([
      {
        type: 'branch',
        name: 'branch',
        cases: {
          default: [{ type: 'text', value: 'Unknown' }],
          pending: [{ type: 'text', value: 'Pending' }],
          shipped: [{ type: 'text', value: 'On its way' }],
          delivered: [{ type: 'text', value: 'Arrived' }],
        },
      },
    ]);
    const slot = branchSlots.get('branch');
    expect(slot?.value).toBe('shipped');
    expect(Object.keys(slot?.cases ?? {}).sort()).toEqual(
      ['default', 'delivered', 'pending', 'shipped'].sort(),
    );
  });

  it('serializes formatter components as auto-named var slots', () => {
    const { tree, varSlots } = serializeChildren(
      <>
        Total: <Currency currency="USD">{42.5}</Currency> on{' '}
        <DateTime>{new Date('2026-01-01')}</DateTime>, viewed <Num>{1234}</Num> times
      </>,
    );
    expect(tree).toEqual([
      { type: 'text', value: 'Total: ' },
      { type: 'var', name: 'currency_0' },
      { type: 'text', value: ' on ' },
      { type: 'var', name: 'dt_0' },
      { type: 'text', value: ', viewed ' },
      { type: 'var', name: 'num_0' },
      { type: 'text', value: ' times' },
    ]);
    expect(varSlots.has('currency_0')).toBe(true);
    expect(varSlots.has('dt_0')).toBe(true);
    expect(varSlots.has('num_0')).toBe(true);
  });

  it('honors an explicit name on formatter components', () => {
    const { tree } = serializeChildren(
      <>
        <Num name="amount">{42}</Num> visitors /{' '}
        <RelativeTime name="seen">{Date.now()}</RelativeTime>
      </>,
    );
    expect(tree).toEqual([
      { type: 'var', name: 'amount' },
      { type: 'text', value: ' visitors / ' },
      { type: 'var', name: 'seen' },
    ]);
  });
});
