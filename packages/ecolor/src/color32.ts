/**
 * Port of `ecolor/src/color32.rs`.
 */

// NOTE: `rgba.ts` imports `Color32` back, so this is a cycle. That is safe in
// ESM because neither module touches the other's binding at evaluation time -
// only inside method bodies, which run long after both modules are initialised.
import { Rgba } from './rgba.js';
import { color32_from_hex, color32_to_hex } from './hex_color_runtime.js';
import { lerp } from '@egui-node/emath';
import { fast_round, mul_frac_round, saturating_add_u8 } from './internal.js';

/**
 * This format is used for space-efficient color representation (32 bits).
 *
 * Instead of manipulating this directly it is often better to first convert it
 * to either {@link Rgba} or {@link Hsva}.
 *
 * Internally this uses 0-255 gamma space `sRGBA` color with _premultiplied alpha_.
 * It's the non-linear ("gamma") values that are multiplied with the alpha.
 *
 * Premultiplied alpha means that the color values have been pre-multiplied with
 * the alpha (opacity). This is in contrast with "normal" RGBA, where the alpha
 * is _separate_ (or "unmultiplied"). Using premultiplied alpha has some
 * advantages:
 * * It allows encoding additive colors
 * * It is the better way to blend colors, e.g. when filtering texture colors
 * * Because the above, it is the better way to encode colors in a GPU texture
 *
 * The color space is assumed to be [sRGB](https://en.wikipedia.org/wiki/SRGB).
 *
 * All operations on `Color32` are done in "gamma space". This is not physically
 * correct, but it is fast and sometimes more perceptually even than linear
 * space. If you instead want to perform these operations in linear-space color,
 * use {@link Rgba}.
 *
 * An `alpha=0` means the color is to be treated as an additive color.
 *
 * All components are plain integers in `[0, 255]`, mirroring Rust's `u8`.
 */
export class Color32 {
  /** Red component multiplied by alpha. */
  r: number;
  /** Green component multiplied by alpha. */
  g: number;
  /** Blue component multiplied by alpha. */
  b: number;
  /** Alpha (opacity). */
  a: number;

  constructor(r: number, g: number, b: number, a: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  /** From RGB with alpha of 255 (opaque). */
  static from_rgb(r: number, g: number, b: number): Color32 {
    return new Color32(r, g, b, 255);
  }

  /** From RGB into an additive color (will make everything it blend with brighter). */
  static from_rgb_additive(r: number, g: number, b: number): Color32 {
    return new Color32(r, g, b, 0);
  }

  /** From `sRGBA` with premultiplied alpha. */
  static from_rgba_premultiplied(r: number, g: number, b: number, a: number): Color32 {
    return new Color32(r, g, b, a);
  }

  /**
   * From `sRGBA` with separate alpha.
   *
   * This is a "normal" RGBA value that you would find in a color picker or a
   * table somewhere. You can use {@link Color32.to_srgba_unmultiplied} to get
   * back these values, but for transparent colors what you get back might be
   * slightly different (rounding errors).
   */
  static from_rgba_unmultiplied(r: number, g: number, b: number, a: number): Color32 {
    return Color32.from_rgba_unmultiplied_const(r, g, b, a);
  }

  /**
   * The same as {@link Color32.from_rgba_unmultiplied}. Rust needs this as a
   * separate `const fn` so it can be evaluated in `const` contexts; there is no
   * such distinction here.
   */
  static from_rgba_unmultiplied_const(r: number, g: number, b: number, a: number): Color32 {
    switch (a) {
      case 0:
        // common-case optimization:
        return Color32.TRANSPARENT;
      case 255:
        // common-case optimization:
        return Color32.from_rgb(r, g, b);
      default: {
        const pr = mul_frac_round(r, a);
        const pg = mul_frac_round(g, a);
        const pb = mul_frac_round(b, a);
        return Color32.from_rgba_premultiplied(pr, pg, pb, a);
      }
    }
  }

  /** Opaque gray. */
  static from_gray(l: number): Color32 {
    return new Color32(l, l, l, 255);
  }

  /** Black with the given opacity. */
  static from_black_alpha(a: number): Color32 {
    return new Color32(0, 0, 0, a);
  }

  /** White with the given opacity. */
  static from_white_alpha(a: number): Color32 {
    return new Color32(a, a, a, a);
  }

  /** Additive white. */
  static from_additive_luminance(l: number): Color32 {
    return new Color32(l, l, l, 0);
  }

  /** From a premultiplied `[r, g, b, a]` tuple. */
  static fromArray(v: readonly [number, number, number, number]): Color32 {
    return new Color32(v[0], v[1], v[2], v[3]);
  }

  /** From a `#RRGGBBAA` string, or one of the other CSS hex forms. */
  static from_hex(hex: string): Color32 {
    return color32_from_hex(hex);
  }

  // Mostly follows CSS names:
  static readonly TRANSPARENT: Color32 = Color32.from_rgba_premultiplied(0, 0, 0, 0);
  static readonly BLACK: Color32 = Color32.from_rgb(0, 0, 0);
  static readonly DARK_GRAY: Color32 = Color32.from_rgb(96, 96, 96);
  static readonly GRAY: Color32 = Color32.from_rgb(160, 160, 160);
  static readonly LIGHT_GRAY: Color32 = Color32.from_rgb(220, 220, 220);
  static readonly WHITE: Color32 = Color32.from_rgb(255, 255, 255);

  static readonly BROWN: Color32 = Color32.from_rgb(165, 42, 42);
  static readonly DARK_RED: Color32 = Color32.from_rgb(0x8b, 0, 0);
  static readonly RED: Color32 = Color32.from_rgb(255, 0, 0);
  static readonly LIGHT_RED: Color32 = Color32.from_rgb(255, 128, 128);

  static readonly CYAN: Color32 = Color32.from_rgb(0, 255, 255);
  static readonly MAGENTA: Color32 = Color32.from_rgb(255, 0, 255);
  static readonly YELLOW: Color32 = Color32.from_rgb(255, 255, 0);

  static readonly ORANGE: Color32 = Color32.from_rgb(255, 165, 0);
  static readonly LIGHT_YELLOW: Color32 = Color32.from_rgb(255, 255, 0xe0);
  static readonly KHAKI: Color32 = Color32.from_rgb(240, 230, 140);

  static readonly DARK_GREEN: Color32 = Color32.from_rgb(0, 0x64, 0);
  static readonly GREEN: Color32 = Color32.from_rgb(0, 255, 0);
  static readonly LIGHT_GREEN: Color32 = Color32.from_rgb(0x90, 0xee, 0x90);

  static readonly DARK_BLUE: Color32 = Color32.from_rgb(0, 0, 0x8b);
  static readonly BLUE: Color32 = Color32.from_rgb(0, 0, 255);
  static readonly LIGHT_BLUE: Color32 = Color32.from_rgb(0xad, 0xd8, 0xe6);

  static readonly PURPLE: Color32 = Color32.from_rgb(0x80, 0, 0x80);

  static readonly GOLD: Color32 = Color32.from_rgb(255, 215, 0);

  static readonly DEBUG_COLOR: Color32 = Color32.from_rgba_premultiplied(0, 200, 0, 128);

  /**
   * An ugly color that is planned to be replaced before making it to the screen.
   *
   * This is an invalid color, in that it does not correspond to a valid
   * multiplied color, nor to an additive color. Used as a special color key,
   * i.e. often taken to mean "no color".
   */
  static readonly PLACEHOLDER: Color32 = Color32.from_rgba_premultiplied(64, 254, 0, 128);

  is_opaque(): boolean {
    return this.a === 255;
  }

  /** Returns an opaque version of self. */
  to_opaque(): Color32 {
    return Rgba.fromColor32(this).to_opaque().toColor32();
  }

  /** Returns an additive version of self. */
  additive(): Color32 {
    return new Color32(this.r, this.g, this.b, 0);
  }

  /** Is the alpha 0? */
  is_additive(): boolean {
    return this.a === 0;
  }

  /** Premultiplied RGBA */
  to_array(): [number, number, number, number] {
    return [this.r, this.g, this.b, this.a];
  }

  /** Premultiplied RGBA */
  to_tuple(): [number, number, number, number] {
    return [this.r, this.g, this.b, this.a];
  }

  /**
   * Convert to a normal "unmultiplied" RGBA color (i.e. with separate alpha).
   *
   * This will unmultiply the alpha. This is the inverse of
   * {@link Color32.from_rgba_unmultiplied}, but due to precision problems it
   * may return slightly different values for transparent colors.
   */
  to_srgba_unmultiplied(): [number, number, number, number] {
    const [r, g, b, a] = this.to_array();
    switch (a) {
      case 0:
      case 255:
        // Common-case optimization.
        return this.to_array();
      default: {
        const factor = 255.0 / a;
        return [fast_round(factor * r), fast_round(factor * g), fast_round(factor * b), a];
      }
    }
  }

  /**
   * Multiply with 0.5 to make color half as opaque, perceptually.
   *
   * Fast multiplication in gamma-space. This is perceptually even, and faster
   * than {@link Color32.linear_multiply}.
   */
  gamma_multiply(factor: number): Color32 {
    if (!(factor >= 0 && Number.isFinite(factor))) {
      throw new RangeError(`Color32::gamma_multiply: factor should be finite, but was ${factor}`);
    }
    return new Color32(
      fast_round(this.r * factor),
      fast_round(this.g * factor),
      fast_round(this.b * factor),
      fast_round(this.a * factor),
    );
  }

  /**
   * Multiply with 127 to make color half as opaque, perceptually.
   *
   * Fast multiplication in gamma-space.
   */
  gamma_multiply_u8(factor: number): Color32 {
    return new Color32(
      Math.floor((this.r * factor + 127) / 255),
      Math.floor((this.g * factor + 127) / 255),
      Math.floor((this.b * factor + 127) / 255),
      Math.floor((this.a * factor + 127) / 255),
    );
  }

  /**
   * Multiply with 0.5 to make color half as opaque in linear space.
   *
   * This is using linear space, which is not perceptually even. You likely want
   * to use {@link Color32.gamma_multiply} instead.
   */
  linear_multiply(factor: number): Color32 {
    if (!(factor >= 0 && Number.isFinite(factor))) {
      throw new RangeError(`Color32::linear_multiply: factor should be finite, but was ${factor}`);
    }
    // As an unfortunate side-effect of using premultiplied alpha we need a
    // somewhat expensive conversion to linear space and back.
    return Rgba.fromColor32(this).multiply(factor).toColor32();
  }

  /**
   * Converts to floating point values in the range 0-1 without any gamma space
   * conversion.
   *
   * Use this with great care! In almost all cases you want to convert to
   * {@link Rgba} instead, in order to obtain linear space color values.
   */
  to_normalized_gamma_f32(): [number, number, number, number] {
    return [this.r / 255.0, this.g / 255.0, this.b / 255.0, this.a / 255.0];
  }

  /** Lerp this color towards `other` by `t` in gamma space. */
  lerp_to_gamma(other: Color32, t: number): Color32 {
    return Color32.from_rgba_premultiplied(
      fast_round(lerp(this.r, other.r, t)),
      fast_round(lerp(this.g, other.g, t)),
      fast_round(lerp(this.b, other.b, t)),
      fast_round(lerp(this.a, other.a, t)),
    );
  }

  /** Blend two colors in gamma space, so that `self` is behind the argument. */
  blend(on_top: Color32): Color32 {
    return this.gamma_multiply_u8(255 - on_top.a).add(on_top);
  }

  /**
   * Intensity of the color. Returns a value in the range 0-1.
   * The brighter the color, the closer to 1.
   */
  intensity(): number {
    return (this.r * 0.299 + this.g * 0.587 + this.b * 0.114) / 255.0;
  }

  /** Formats the color as a hex string, e.g. `"#ff0000ff"`. */
  to_hex(): string {
    return color32_to_hex(this);
  }

  // --------------------------------------------------------------------------
  // Operator impls
  // --------------------------------------------------------------------------

  /** Fast gamma-space multiplication. */
  mul(other: Color32): Color32 {
    return new Color32(
      fast_round((this.r * other.r) / 255.0),
      fast_round((this.g * other.g) / 255.0),
      fast_round((this.b * other.b) / 255.0),
      fast_round((this.a * other.a) / 255.0),
    );
  }

  /** Saturating component-wise addition. */
  add(other: Color32): Color32 {
    return new Color32(
      saturating_add_u8(this.r, other.r),
      saturating_add_u8(this.g, other.g),
      saturating_add_u8(this.b, other.b),
      saturating_add_u8(this.a, other.a),
    );
  }

  /** `self[0]` .. `self[3]`. Throws past index 3, matching the Rust panic. */
  get(index: number): number {
    switch (index) {
      case 0:
        return this.r;
      case 1:
        return this.g;
      case 2:
        return this.b;
      case 3:
        return this.a;
      default:
        throw new RangeError(`Color32 index out of bounds: ${index}`);
    }
  }

  /** `self[index] = value`. Throws past index 3, matching the Rust panic. */
  set(index: number, value: number): void {
    switch (index) {
      case 0:
        this.r = value;
        return;
      case 1:
        this.g = value;
        return;
      case 2:
        this.b = value;
        return;
      case 3:
        this.a = value;
        return;
      default:
        throw new RangeError(`Color32 index out of bounds: ${index}`);
    }
  }

  clone(): Color32 {
    return new Color32(this.r, this.g, this.b, this.a);
  }

  equals(other: Color32): boolean {
    return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a;
  }

  /** Rust's `impl fmt::Debug for Color32`, which prints premultiplied alpha. */
  toString(): string {
    const hex = (u: number) => u.toString(16).toUpperCase().padStart(2, '0');
    return `#${hex(this.r)}_${hex(this.g)}_${hex(this.b)}_${hex(this.a)}`;
  }
}