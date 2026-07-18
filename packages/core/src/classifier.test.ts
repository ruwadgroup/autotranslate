import { describe, expect, it } from 'vitest';
import {
  CLASSIFIER_VERSION,
  isAllowlistedAttribute,
  isCopyBearingName,
  isTranslatableAttribute,
  jsxTextHasContent,
  NO_TRANSLATE_ATTRIBUTE,
  SKIP_ELEMENTS,
  TRANSLATION_MARKERS,
} from './classifier';

describe('CLASSIFIER_VERSION', () => {
  it('is 6', () => {
    expect(CLASSIFIER_VERSION).toBe(6);
  });
});

describe('isCopyBearingName', () => {
  it('recognizes conventional interface-copy fields', () => {
    for (const name of [
      'label',
      'title',
      'description',
      'header',
      'helperText',
      'emptyTitle',
      'buttonLabel',
      'cardDescription',
      'tableHeader',
      'singular',
      'plural',
      'verb',
      'cta',
      'createCta',
      'primaryCTA',
    ]) {
      expect(isCopyBearingName(name), `should recognize: ${name}`).toBe(true);
    }
  });

  it('rejects structural and data fields', () => {
    for (const name of ['value', 'id', 'name', 'key', 'href', 'url', 'userName']) {
      expect(isCopyBearingName(name), `should reject: ${name}`).toBe(false);
    }
  });
});

describe('TRANSLATION_MARKERS', () => {
  it('contains all 8 marker names', () => {
    const expected = [
      'T',
      'Var',
      'Plural',
      'Branch',
      'Num',
      'Currency',
      'DateTime',
      'RelativeTime',
    ];
    expect(TRANSLATION_MARKERS.size).toBe(8);
    for (const name of expected) {
      expect(TRANSLATION_MARKERS.has(name), `missing: ${name}`).toBe(true);
    }
  });

  it('does not contain unexpected names', () => {
    expect(TRANSLATION_MARKERS.has('span')).toBe(false);
    expect(TRANSLATION_MARKERS.has('div')).toBe(false);
    expect(TRANSLATION_MARKERS.has('t')).toBe(false);
    expect(TRANSLATION_MARKERS.has('Tx')).toBe(false);
  });
});

describe('jsxTextHasContent', () => {
  it('returns false for empty string', () => {
    expect(jsxTextHasContent('')).toBe(false);
  });

  it('returns false for whitespace-only strings', () => {
    expect(jsxTextHasContent('   ')).toBe(false);
    expect(jsxTextHasContent('\n')).toBe(false);
    expect(jsxTextHasContent('\n  \t  \n')).toBe(false);
  });

  it('returns true for strings with visible content', () => {
    expect(jsxTextHasContent('Hello')).toBe(true);
    expect(jsxTextHasContent('  Hello  ')).toBe(true);
    expect(jsxTextHasContent(' a ')).toBe(true);
  });

  it('collapses multiple whitespace characters before checking', () => {
    expect(jsxTextHasContent('\n  Hello world  \n')).toBe(true);
    expect(jsxTextHasContent('  \n  ')).toBe(false);
  });
});

describe('isAllowlistedAttribute', () => {
  const exactAllowlist = [
    'className',
    'class',
    'id',
    'key',
    'ref',
    'name',
    'type',
    'role',
    'slot',
    'style',
    'data-testid',
    'href',
    'src',
    'srcSet',
    'alt',
    'as',
    'rel',
    'target',
    'method',
    'action',
    'encType',
    'autoComplete',
    'autoCorrect',
    'spellCheck',
    'pattern',
    'inputMode',
    'width',
    'height',
    'size',
    'tabIndex',
    'lang',
    'dir',
    'translate',
    'data-test',
    'data-cy',
  ];

  it('allowlist has exactly 35 entries', () => {
    expect(exactAllowlist).toHaveLength(35);
  });

  it('returns true for every exact allowlist entry', () => {
    for (const attr of exactAllowlist) {
      expect(isAllowlistedAttribute(attr), `should allowlist: ${attr}`).toBe(true);
    }
  });

  it('returns true for any data- prefixed attribute', () => {
    expect(isAllowlistedAttribute('data-foo')).toBe(true);
    expect(isAllowlistedAttribute('data-bar-baz')).toBe(true);
    expect(isAllowlistedAttribute('data-custom-thing')).toBe(true);
    expect(isAllowlistedAttribute('data-no-translate')).toBe(true);
  });

  it('returns false for non-allowlisted attributes', () => {
    expect(isAllowlistedAttribute('title')).toBe(false);
    expect(isAllowlistedAttribute('placeholder')).toBe(false);
    expect(isAllowlistedAttribute('aria-label')).toBe(false);
    expect(isAllowlistedAttribute('aria-describedby')).toBe(false);
    expect(isAllowlistedAttribute('value')).toBe(false);
    expect(isAllowlistedAttribute('label')).toBe(false);
  });
});

describe('NO_TRANSLATE_ATTRIBUTE', () => {
  it('equals "data-no-translate"', () => {
    expect(NO_TRANSLATE_ATTRIBUTE).toBe('data-no-translate');
  });

  it('is itself allowlisted (data- prefix)', () => {
    expect(isAllowlistedAttribute(NO_TRANSLATE_ATTRIBUTE)).toBe(true);
  });
});

describe('SKIP_ELEMENTS', () => {
  it('contains exactly code, pre, script, style', () => {
    expect(SKIP_ELEMENTS.size).toBe(4);
    expect(SKIP_ELEMENTS.has('code')).toBe(true);
    expect(SKIP_ELEMENTS.has('pre')).toBe(true);
    expect(SKIP_ELEMENTS.has('script')).toBe(true);
    expect(SKIP_ELEMENTS.has('style')).toBe(true);
  });

  it('does not contain translatable element names', () => {
    expect(SKIP_ELEMENTS.has('p')).toBe(false);
    expect(SKIP_ELEMENTS.has('div')).toBe(false);
    expect(SKIP_ELEMENTS.has('span')).toBe(false);
  });
});

describe('isTranslatableAttribute', () => {
  it('recognizes the complete positive set of visual and accessibility copy', () => {
    for (const name of [
      'placeholder',
      'title',
      'alt',
      'label',
      'aria-label',
      'aria-description',
      'aria-placeholder',
      'aria-roledescription',
      'aria-valuetext',
    ]) {
      expect(isTranslatableAttribute(name), `should translate: ${name}`).toBe(true);
    }
  });

  it('rejects structural HTML, SVG, ARIA, styling, and unknown attributes', () => {
    for (const name of [
      'className',
      'href',
      'id',
      'role',
      'accept',
      'aria-live',
      'aria-describedby',
      'aria-controls',
      'viewBox',
      'fill',
      'stroke',
      'strokeLinecap',
      'textAnchor',
      'vectorEffect',
      'shapeRendering',
      'xmlns',
      'data-testid',
      'data-anything',
      'unknownLibraryToken',
      'value',
    ]) {
      expect(isTranslatableAttribute(name), `should not translate: ${name}`).toBe(false);
    }
  });
});
