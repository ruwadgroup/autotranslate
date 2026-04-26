import { parseICU } from '@autotranslate/core/icu';
import { TYPE } from '@formatjs/icu-messageformat-parser';

/**
 * Reversible placeholder shield for translators that don't understand ICU
 * MessageFormat. Replaces `{name}` and `{age, number}` argument placeholders
 * with opaque sentinels (`[[ATPH:0]]`) so the translator only sees natural-
 * language text, then restores the originals after.
 *
 * Plural / select / pound (`#`) / tag elements are out of scope — they
 * carry translatable copy inside their arms which a flat shield would lose.
 * Callers should reject those entries before invoking the shield.
 */
export interface ShieldResult {
  /** The shielded text — safe to send to a non-ICU translator. */
  readonly text: string;
  /** Map from sentinel index → original ICU expression text (`{name}`, etc.). */
  readonly slots: ReadonlyArray<string>;
}

const SENTINEL = '[[ATPH:%d]]';

/**
 * Encode every supported placeholder in `input` as a sentinel. Throws when
 * the input contains an unsupported ICU element (plural / select / pound /
 * tag wrapper) so callers route those to a provider that can handle them.
 */
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
        // Preserve the ICU formatter syntax verbatim — the translator just
        // needs to leave the sentinel alone, not understand the format.
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

/**
 * Restore sentinels in `translated` with the original ICU expressions
 * captured by `shieldPlaceholders`. Missing sentinels are left as-is.
 */
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
