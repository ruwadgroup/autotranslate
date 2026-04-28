import { gzipSync } from 'node:zlib';
import { bench, describe } from 'vitest';
import { createTranslator } from '../src/runtime';

const flatCatalog = (size: number): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let i = 0; i < size; i += 1) out[`key_${i}`] = `Translated string number ${i}`;
  return out;
};

const icuCatalog = (size: number): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let i = 0; i < size; i += 1) {
    out[`key_${i}`] = `{count, plural, one {1 item ${i}} other {# items ${i}}}`;
  }
  return out;
};

describe('translator.t() hot path', () => {
  const cat = flatCatalog(100);
  const t = createTranslator({ locale: 'en', catalog: cat });

  bench('plain string lookup', () => {
    t.t('key_42');
  });

  bench('plain string lookup with miss + source fallback', () => {
    t.t('not_in_catalog');
  });
});

describe('translator.t() with ICU', () => {
  const cat = icuCatalog(100);
  const t = createTranslator({ locale: 'en', catalog: cat });

  bench('ICU plural format (one)', () => {
    t.t('key_42', { count: 1 });
  });

  bench('ICU plural format (other)', () => {
    t.t('key_42', { count: 5 });
  });
});

describe('catalog gzip size', () => {
  const cat = flatCatalog(100);
  const json = JSON.stringify(cat);
  const gzipped = gzipSync(json);

  bench(`flat 100-string catalog (raw ${json.length}B, gzip ${gzipped.length}B)`, () => {
    gzipSync(JSON.stringify(cat));
  });
});
