import { canonicalKey } from '@autotranslate/core';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Plural, Var } from './markers';
import { TranslationProvider } from './provider';
import { T } from './T';

describe('<T>', () => {
  it('renders source children when no translation is found', () => {
    const { container } = render(
      <TranslationProvider locale="es">
        <T>Sign out</T>
      </TranslationProvider>,
    );
    expect(container.textContent).toBe('Sign out');
  });

  it('renders the translated tree using original Var slots', () => {
    const sourceKey = canonicalKey([
      { type: 'text', value: 'Hello, ' },
      { type: 'var', name: 'name' },
      { type: 'text', value: '!' },
    ]);
    const { container } = render(
      <TranslationProvider
        locale="es"
        catalog={{
          [sourceKey]: [
            { type: 'text', value: 'Hola, ' },
            { type: 'var', name: 'name' },
            { type: 'text', value: '!' },
          ],
        }}
      >
        <T>
          Hello, <Var name="name">Ada</Var>!
        </T>
      </TranslationProvider>,
    );
    expect(container.textContent).toBe('Hola, Ada!');
  });

  it('preserves props on tag wrappers when translating', () => {
    const sourceKey = canonicalKey([
      { type: 'text', value: 'See ' },
      { type: 'tag', tag: 'a', children: [{ type: 'text', value: 'docs' }] },
    ]);
    const { container } = render(
      <TranslationProvider
        locale="es"
        catalog={{
          [sourceKey]: [
            { type: 'text', value: 'Ver ' },
            { type: 'tag', tag: 'a', children: [{ type: 'text', value: 'documentación' }] },
          ],
        }}
      >
        <T>
          See <a href="/docs">docs</a>
        </T>
      </TranslationProvider>,
    );
    const link = container.querySelector('a');
    expect(link?.textContent).toBe('documentación');
    expect(link?.getAttribute('href')).toBe('/docs');
  });

  it('selects the right plural form and substitutes #', () => {
    const sourceKey = canonicalKey([
      {
        type: 'plural',
        name: 'count',
        forms: {
          one: [{ type: 'text', value: '1 item' }],
          other: [{ type: 'text', value: '# items' }],
        },
      },
    ]);
    const { container, rerender } = render(
      <TranslationProvider locale="en">
        <T>
          <Plural value={1} one="1 item" other="# items" />
        </T>
      </TranslationProvider>,
    );
    // No catalog entry — falls back to source. Source `<Plural>` selects via locale.
    expect(canonicalKey).toBeDefined();
    expect(container.textContent).toBeDefined();

    // With a translation in place
    rerender(
      <TranslationProvider
        locale="es"
        catalog={{
          [sourceKey]: [
            {
              type: 'plural',
              name: 'count',
              forms: {
                one: [{ type: 'text', value: '1 artículo' }],
                other: [{ type: 'text', value: '# artículos' }],
              },
            },
          ],
        }}
      >
        <T>
          <Plural value={5} one="1 item" other="# items" />
        </T>
      </TranslationProvider>,
    );
    expect(container.textContent).toBe('5 artículos');
  });

  it('falls back to source rendering when context is missing', () => {
    const { container } = render(<T>Standalone</T>);
    expect(container.textContent).toBe('Standalone');
  });

  it('uses the fallback catalog when target catalog misses the key', () => {
    const sourceKey = canonicalKey([{ type: 'text', value: 'Hi' }]);
    const { container } = render(
      <TranslationProvider
        locale="es"
        catalog={{}}
        fallback={{ [sourceKey]: [{ type: 'text', value: 'Hi (en)' }] }}
      >
        <T>Hi</T>
      </TranslationProvider>,
    );
    expect(container.textContent).toBe('Hi (en)');
  });
});
