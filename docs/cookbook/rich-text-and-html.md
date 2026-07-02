# Rich text & HTML in translations

Translate JSX with links, bold text, and other inline formatting without
breaking the structure. For longer-form content like paragraphs, lists, and
headings, two patterns work: structured trees and Markdown.

## Inline formatting - tag wrappers

```tsx
<T>
  Read the <a href="/docs">documentation</a> or follow the{' '}
  <strong>quick start</strong>.
</T>
```

The extractor records each tag as a node in the canonical tree. Translators can
move tags but can't change their structure. Props (`href`, `className`, event
handlers) ride along with the rendered output:

```tsx
<T>
  Click{' '}
  <button type="button" onClick={handleClick}>
    here
  </button>{' '}
  to retry.
</T>
```

The translator sees `Click <button>here</button> to retry.` - button props are
opaque.

## Component wrappers

The same pattern works with custom components:

```tsx
<T>
  Save <Strong>$5</Strong> on your next order.
</T>
```

The extractor uses the JSX identifier (`Strong`). The runtime falls back to
`type.displayName` (or `type.name`) when reconstructing the tag.

## Long-form copy - multiple `<T>` blocks

For paragraphs, give each logical message its own `<T>`:

```tsx
<article>
  <h1>
    <T>Welcome to autotranslate</T>
  </h1>
  <p>
    <T>Code-first i18n for React. Write strings inline.</T>
  </p>
  <p>
    <T>
      Run a command. Get translated catalogs. <a href="/docs">Read more.</a>
    </T>
  </p>
</article>
```

One `<T>` per logical message - that's the unit translators rearrange. Don't
wrap an entire article in a single `<T>`; the structure becomes opaque to the AI
and any DOM-changing edit invalidates the translation.

## Markdown - translate the source, render after

Translate Markdown as a plain string, then render with your Markdown library:

```tsx
import Markdown from 'react-markdown';
import { useT } from '@autotranslate/react';

function FaqAnswer() {
  const t = useT();
  const md = t(`
You can:

- Add an entry to \`overrides\` in your config
- Wrap the value in \`<Var>\` to protect it from translation
- Override one schema's message via Zod's \`{ error }\` API
  `);
  return <Markdown>{md}</Markdown>;
}
```

The translator sees the literal Markdown including syntax - the AI is trained on
it and won't break list markers or code spans. Keep the indentation tight; trim
it before rendering if needed.

For longer corpora, keep the Markdown source as a long literal string key:

```tsx
import Markdown from 'react-markdown';
import { useT } from '@autotranslate/react';

function FaqCustomOverrides() {
  const t = useT();
  const md = t(`
You can:

- Add an entry to \`overrides\` in your config
- Wrap the value in \`<Var>\` to protect it from translation
  `);
  return <Markdown>{md}</Markdown>;
}
```

## HTML - sanitise before rendering

If a translator's output goes through `dangerouslySetInnerHTML`, sanitise it.
The bundled translator preserves placeholder structure but doesn't strip
arbitrary HTML:

```tsx
import DOMPurify from 'dompurify';
import { useT } from '@autotranslate/react';

function Body() {
  const t = useT();
  const html = DOMPurify.sanitize(t('legal.privacy_html'));
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

Better: avoid `dangerouslySetInnerHTML` and use `<T>` with tag wrappers instead.

## Don't translate raw HTML strings

```tsx
// DON'T
t('<p>Welcome to <strong>autotranslate</strong></p>');
```

The translator can't tell which characters are content vs. markup. Two problems
arise:

1. The AI may translate the tag names.
2. Special characters (`<`, `>`) become text on miss.

Use `<T>` with JSX wrappers:

```tsx
// DO
<T>
  Welcome to <strong>autotranslate</strong>
</T>
```

## Tips

- **One `<T>` per sentence.** Word order varies dramatically across languages -
  translators need the whole sentence to rearrange properly.

- **Keep Markdown lists short.** If you have a 12-bullet list, translators may
  rewrite the connective tissue, which is usually a feature.

- **Sanitise translator output before `dangerouslySetInnerHTML`.** Even trusted
  sources can ship surprising whitespace or attributes when the AI gets
  adventurous.

- **Don't HTML-encode placeholders.** `t('Hello, &lt;name&gt;', { name })`
  doesn't work - placeholders are ICU `{name}`, not HTML.
