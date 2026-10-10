/**
 * Port of `ecolor/src/hex_color_runtime.rs`.
 *
 * Convert colors to and from the hex-color string format at runtime.
 * Supports the 3, 4, 6, and 8-digit formats, according to the specification in
 * <https://drafts.csswg.org/css-color-4/#hex-color>
 *
 * Rust's `FromStr` returns a `Result`, so parsing here returns a discriminated
 * union rather than throwing, matching upstream for untrusted input.
 */

// Cycle with `color32.ts`, safe for the same reason: only used in function bodies.
import { Color32 } from './color32.js';

/** The four hex digit-counts from the CSS Color 4 spec. */
export type HexFormat = 3 | 4 | 6 | 8;

/** Why a hex string could not be parsed. Mirrors `ParseHexColorError`. */
export type ParseHexColorError =
  | { kind: 'MissingHash' }
  | { kind: 'InvalidLength'; length: number }
  | { kind: 'InvalidInt'; input: string; position: number };

/** A `Result`-like return type, matching Rust's `Result<T, E>`. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: ParseHexColorError };

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

function err<T>(error: ParseHexColorError): Result<T> {
  return { ok: false, error };
}

/**
 * A wrapper around Color32 that converts to and from a hex-color string.
 *
 * The format is remembered, so `toString()` round-trips in the same shape it
 * was parsed from.
 */
export class HexColor {
  /** Which of the CSS hex digit-counts to render. */
  readonly format: HexFormat;

  private readonly color_: Color32;

  private constructor(color: Color32, format: HexFormat) {
    this.color_ = color;
    this.format = format;
  }

  /** 3 hexadecimal digits, one for each of the r, g, b channels */
  static hex3(color: Color32): HexColor {
    return new HexColor(color, 3);
  }

  /** 4 hexadecimal digits, one for each of the r, g, b, a channels */
  static hex4(color: Color32): HexColor {
    return new HexColor(color, 4);
  }

  /** 6 hexadecimal digits, two for each of the r, g, b channels */
  static hex6(color: Color32): HexColor {
    return new HexColor(color, 6);
  }

  /** 8 hexadecimal digits, one for each of the r, g, b, a channels */
  static hex8(color: Color32): HexColor {
    return new HexColor(color, 8);
  }

  /** Retrieves the inner Color32. */
  color(): Color32 {
    return this.color_;
  }

  /**
   * Parses a string as a hex color, requiring the leading `#`.
   *
   * Returns an error if the string doesn't start with `#`, if the remaining
   * length is not 3, 4, 6 or 8, or if it contains non-hex characters.
   */
  static from_str(s: string): Result<HexColor> {
    if (!s.startsWith('#')) {
      return err({ kind: 'MissingHash' });
    }
    return HexColor.from_str_without_hash(s.slice(1));
  }

  /**
   * Parses a string as a hex color without the leading `#` character.
   *
   * Returns an error if the length of the string does not correspond to one of
   * the standard formats (3, 4, 6, or 8), or if it contains non-hex characters.
   */
  static from_str_without_hash(s: string): Result<HexColor> {
    const bad = parseHexError(s);
    if (bad) {
      return err(bad);
    }

    switch (s.length) {
      case 3: {
        const v = Number.parseInt(s, 16);
        const r = (v >> 8) & 0xf;
        const gb = v & 0xff;
        const g = gb >> 4;
        const b = gb & 0x0f;
        return ok(HexColor.hex3(Color32.from_rgb(expand(r), expand(g), expand(b))));
      }
      case 4: {
        const v = Number.parseInt(s, 16);
        const rg = v >> 8;
        const ba = v & 0xff;
        const r = rg >> 4;
        const g = rg & 0x0f;
        const b = ba >> 4;
        const a = ba & 0x0f;
        return ok(HexColor.hex4(Color32.from_rgba_unmultiplied(expand(r), expand(g), expand(b), expand(a))));
      }
      case 6: {
        const v = Number.parseInt(s, 16);
        const r = (v >> 16) & 0xff;
        const g = (v >> 8) & 0xff;
        const b = v & 0xff;
        return ok(HexColor.hex6(Color32.from_rgb(r, g, b)));
      }
      case 8: {
        const v = Number.parseInt(s, 16);
        const r = (v >>> 24) & 0xff;
        const g = (v >> 16) & 0xff;
        const b = (v >> 8) & 0xff;
        const a = v & 0xff;
        return ok(HexColor.hex8(Color32.from_rgba_unmultiplied(r, g, b, a)));
      }
      default:
        return err({ kind: 'InvalidLength', length: s.length });
    }
  }

  clone(): HexColor {
    return new HexColor(this.color_, this.format);
  }

  equals(other: HexColor): boolean {
    return this.format === other.format && this.color_.equals(other.color_);
  }

  toString(): string {
    const [r, g, b, a] = this.color_.to_srgba_unmultiplied();
    switch (this.format) {
      case 3:
        return `#${nibble(r)}${nibble(g)}${nibble(b)}`;
      case 4:
        return `#${nibble(r)}${nibble(g)}${nibble(b)}${nibble(a)}`;
      case 6:
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
      default:
        return `#${(((r << 24) >>> 0) + (g << 16) + (b << 8) + a).toString(16).padStart(8, '0')}`;
    }
  }
}

function nibble(u: number): string {
  return (u >> 4).toString(16);
}

/** `(u << 4) | u`: expand a single hex digit to a full byte. */
function expand(u: number): number {
  return (u << 4) | u;
}

const HEX_DIGITS = /^[0-9a-fA-F]*$/;

/** Returns an error if `s` contains non-hex characters, else `null`. */
function parseHexError(s: string): ParseHexColorError | null {
  if (HEX_DIGITS.test(s)) {
    return null;
  }
  const position = [...s].findIndex((c) => !/[0-9a-fA-F]/.test(c));
  return { kind: 'InvalidInt', input: s, position };
}

/**
 * Parses a color from a hex string.
 *
 * Supports the 3, 4, 6, and 8-digit formats, according to <https://drafts.csswg.org/css-color-4/#hex-color>
 *
 * ```
 * color32_from_hex('#ff0000')  === Color32.RED
 * color32_from_hex('#00ff00ff') === Color32.GREEN
 * color32_from_hex('#00f')     === Color32.BLUE
 * color32_from_hex('#0000')    === Color32.TRANSPARENT
 * ```
 */
export function color32_from_hex(hex: string): Color32 {
  const parsed = HexColor.from_str(hex);
  if (!parsed.ok) {
    throw new TypeError(`Color32::from_hex: invalid hex color ${JSON.stringify(hex)} (${parsed.error.kind})`);
  }
  return parsed.value.color();
}

/**
 * Formats the color as an 8-digit hex string, which is the only lossless
 * format. For the other formats, see {@link HexColor}.
 *
 * ```
 * Color32.RED.to_hex()         === '#ff0000ff'
 * Color32.GREEN.to_hex()       === '#00ff00ff'
 * Color32.BLUE.to_hex()        === '#0000ffff'
 * Color32.TRANSPARENT.to_hex() === '#00000000'
 * ```
 */
export function color32_to_hex(c: Color32): string {
  return HexColor.hex8(c).toString();
}

// --------------------------------------------------------------------------
// The analogue of the `hex_color!` proc macro.
// --------------------------------------------------------------------------

/**
 * Construct a Color32 from a hex RGB or RGBA string literal.
 *
 * ```
 * hex_color('#202122')   === Color32.from_rgb(0x20, 0x21, 0x22)
 * hex_color('202122')    === Color32.from_rgb(0x20, 0x21, 0x22)
 * hex_color('#abcdef12') === Color32.from_rgba_unmultiplied(0xab, 0xcd, 0xef, 0x12)
 * ```
 *
 * ## Why there is no compile-time check
 *
 * `ecolor::hex_color!` is a proc macro, so it rejects a malformed string
 * literal at *compile* time. The closest TypeScript equivalent is a template
 * literal type such as:
 *
 * ```ts
 * type HexColorString =
 *   | `#${H}${H}${H}` | `#${H}${H}${H}${H}` | `#${H}${H}${H}${H}${H}${H}` | `#${H.repeat(8)}`
 * ```
 *
 * but that is not usable: TypeScript expands it eagerly into the full cross
 * product (20^3 + 20^4 + 20^6 + 20^8 ≈ 2.6e10 members) and fails with
 * `TS2590: Expression produces a union type that is too complex to represent`
 * before it ever gets to type-check a call site.
 *
 * So the format is validated at runtime instead, and a bad literal throws at
 * the point of use rather than failing to compile.
 */
export function hex_color(s: string): Color32 {
  const result = HexColor.from_str(s.startsWith('#') ? s : `#${s}`);
  if (!result.ok) {
    throw new TypeError(
      `hex_color: ${JSON.stringify(s)} is not a valid hex color ` +
        `(expected 3, 4, 6 or 8 hex digits with an optional leading '#'): ${result.error.kind}`,
    );
  }
  return result.value.color();
}