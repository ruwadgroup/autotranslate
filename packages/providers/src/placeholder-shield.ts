import { parseICU } from '@autotranslate/core/icu';
import { TYPE } from '@formatjs/icu-messageformat-parser';

/**
 * Reversible placeholder shield for translators that don't understand ICU.
 * Replaces argument placeholders with opaque `[[ATPH:N]]` sentinels and
 * restores the originals after.
 *
 * Plural / select / pound / tag elements throw — they carry translatable
 * copy inside their arms.
 */
export interface ShieldResult {
  readonly text: string;
  readonly slots: ReadonlyArray<string>;
}

const SENTINEL = '[[ATPH:%d]]';

export function shieldPlaceholders(input: string): ShieldResult {
  const ast = parseICU(input);
  const slots: string[] = [];
  let out = '';
  for (const el of ast) {
    switch (el.type) {
      case TYPE.literal:
        out += el.value;
        break;
      case TYPE.argument: {
        const original = `{${el.value}}`;
        slots.push(original);
        out += SENTINEL.replace('%d', String(slots.length - 1));
        break;
      }
      case TYPE.number:
      case TYPE.date:
      case TYPE.time: {
        const style = (el as { style?: unknown }).style;
        const original =
          typeof style === 'string'
            ? `{${el.value}, ${typeName(el.type)}, ${style}}`
            : `{${el.value}, ${typeName(el.type)}}`;
        slots.push(original);
        out += SENTINEL.replace('%d', String(slots.length - 1));
        break;
      }
      default:
        throw new UnsupportedICUError(el.type);
    }
  }
  return { text: out, slots };
}

export function restorePlaceholders(translated: string, slots: ReadonlyArray<string>): string {
  return translated.replace(/\[\[ATPH:(\d+)\]\]/g, (match, raw) => {
    const idx = Number.parseInt(raw, 10);
    return slots[idx] ?? match;
  });
}

export class UnsupportedICUError extends Error {
  override readonly name = 'UnsupportedICUError';
  constructor(elementType: number) {
    super(
      `ICU element type ${elementType} (plural / select / pound / tag) isn't supported by ` +
        'this provider — route the entry through the `ai` provider instead.',
    );
  }
}

function typeName(type: number): string {
  switch (type) {
    case TYPE.number:
      return 'number';
    case TYPE.date:
      return 'date';
    case TYPE.time:
      return 'time';
    default:
      return 'unknown';
  }
}
