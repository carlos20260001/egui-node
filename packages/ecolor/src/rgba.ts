/**
 * Port of `ecolor/src/rgba.rs`.
 */

// Cycle with `color32.ts`, safe for the same reason: only used in method bodies.
import { Color32 } from './color32.js';
import { fast_round } from './internal.js';

/**
 * 0-1 linear space `RGBA` color with premultiplied alpha.
 *
 * See {@link Color32} for an explanation of what "premultiplied alpha" means.
 *
 * All components are floats, mirroring Rust's `f32`.
 */
export class Rgba {
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

  static readonly TRANSPARENT: Rgba = Rgba.from_rgba_premultiplied(0.0, 0.0, 0.0, 0.0);
  static readonly BLACK: Rgba = Rgba.from_rgb(0.0, 0.0, 0.0);
  static readonly WHITE: Rgba = Rgba.from_rgb(1.0, 1.0, 1.0);
  static readonly RED: Rgba = Rgba.from_rgb(1.0, 0.0, 0.0);
  static readonly GREEN: Rgba = Rgba.from_rgb(0.0, 1.0, 0.0);
  static readonly BLUE: Rgba = Rgba.from_rgb(0.0, 0.0, 1.0);

  static from_rgba_premultiplied(r: number, g: number, b: number, a: number): Rgba {
    return new Rgba(r, g, b, a);
  }

  static from_rgba_unmultiplied(r: number, g: number, b: number, a: number): Rgba {
    return new Rgba(r * a, g * a, b * a, a);
  }

  static from_srgba_premultiplied(r: number, g: number, b: number, a: number): Rgba {
    return Rgba.fromColor32(Color32.from_rgba_premultiplied(r, g, b, a));
  }

  static from_srgba_unmultiplied(r: number, g: number, b: number, a: number): Rgba {
    return Rgba.fromColor32(Color32.from_rgba_unmultiplied(r, g, b, a));
  }

  static from_rgb(r: number, g: number, b: number): Rgba {
    return new Rgba(r, g, b, 1.0);
  }

  static from_gray(l: number): Rgba {
    return new Rgba(l, l, l, 1.0);
  }

  static from_luminance_alpha(l: number, a: number): Rgba {
    if (!(l >= 0 && l <= 1)) {
      throw new RangeError(`Rgba::from_luminance_alpha: l should be in the range [0, 1], but was ${l}`);
    }
    if (!(a >= 0 && a <= 1)) {
      throw new RangeError(`Rgba::from_luminance_alpha: a should be in the range [0, 1], but was ${a}`);
    }
    return new Rgba(l * a, l * a, l * a, a);
  }

  /** Transparent black */
  static from_black_alpha(a: number): Rgba {
    if (!(a >= 0 && a <= 1)) {
      throw new RangeError(`Rgba::from_black_alpha: a should be in the range [0, 1], but was ${a}`);
    }
    return new Rgba(0.0, 0.0, 0.0, a);
  }

  /** Transparent white */
  static from_white_alpha(a: number): Rgba {
    if (!(a >= 0 && a <= 1)) {
      throw new RangeError(`Rgba::from_white_alpha: a should be in the range [0, 1], but was ${a}`);
    }
    return new Rgba(a, a, a, a);
  }

  static fromArray(v: readonly [number, number, number, number]): Rgba {
    return new Rgba(v[0], v[1], v[2], v[3]);
  }

  /** `impl From<Color32> for Rgba` */
  static fromColor32(srgba: Color32): Rgba {
    const [r, g, b, a] = srgba.to_array();
    if (a === 0) {
      // Additive, or completely transparent
      return new Rgba(linear_f32_from_gamma_u8(r), linear_f32_from_gamma_u8(g), linear_f32_from_gamma_u8(b), 0.0);
    }
    const af = linear_f32_from_linear_u8(a);
    return new Rgba(
      linear_from_gamma(r / (255.0 * af)) * af,
      linear_from_gamma(g / (255.0 * af)) * af,
      linear_from_gamma(b / (255.0 * af)) * af,
      af,
    );
  }

  /** `impl From<Rgba> for Color32` */
  toColor32(): Color32 {
    const [r, g, b, a] = this.to_array();
    if (a === 0.0) {
      // Additive, or completely transparent
      return new Color32(gamma_u8_from_linear_f32(r), gamma_u8_from_linear_f32(g), gamma_u8_from_linear_f32(b), 0);
    }
    return new Color32(
      fast_round(gamma_u8_from_linear_f32(r / a) * a),
      fast_round(gamma_u8_from_linear_f32(g / a) * a),
      fast_round(gamma_u8_from_linear_f32(b / a) * a),
      linear_u8_from_linear_f32(a),
    );
  }

  /** Return an additive version of this color (alpha = 0). */
  additive(): Rgba {
    return new Rgba(this.r, this.g, this.b, 0.0);
  }

  /** Is the alpha 0? */
  is_additive(): boolean {
    return this.a === 0.0;
  }

  /** Multiply with e.g. 0.5 to make us half transparent. */
  multiply(alpha: number): Rgba {
    return new Rgba(alpha * this.r, alpha * this.g, alpha * this.b, alpha * this.a);
  }

  /** How perceptually intense (bright) is the color? */
  intensity(): number {
    return 0.3 * this.r + 0.59 * this.g + 0.11 * this.b;
  }

  /** Returns an opaque version of self. */
  to_opaque(): Rgba {
    if (this.a === 0.0) {
      // Additive or fully transparent black.
      return Rgba.from_rgb(this.r, this.g, this.b);
    }
    // un-multiply alpha:
    return Rgba.from_rgb(this.r / this.a, this.g / this.a, this.b / this.a);
  }

  /** Premultiplied RGBA */
  to_array(): [number, number, number, number] {
    return [this.r, this.g, this.b, this.a];
  }

  /** Premultiplied RGBA */
  to_tuple(): [number, number, number, number] {
    return [this.r, this.g, this.b, this.a];
  }

  /** unmultiply the alpha */
  to_rgba_unmultiplied(): [number, number, number, number] {
    const a = this.a;
    if (a === 0.0) {
      // Additive, let's assume we are black
      return this.to_array();
    }
    return [this.r / a, this.g / a, this.b / a, a];
  }

  /** unmultiply the alpha */
  to_srgba_unmultiplied(): [number, number, number, number] {
    return this.toColor32().to_srgba_unmultiplied();
  }

  /** Blend two colors in linear space, so that `self` is behind the argument. */
  blend(on_top: Rgba): Rgba {
    return this.multiply(1.0 - on_top.a).add(on_top);
  }

  // --------------------------------------------------------------------------
  // Operator impls
  // --------------------------------------------------------------------------

  add(rhs: Rgba): Rgba {
    return new Rgba(this.r + rhs.r, this.g + rhs.g, this.b + rhs.b, this.a + rhs.a);
  }

  /** Component-wise for an `Rgba`, scalar for a `number`. */
  mul(rhs: Rgba | number): Rgba {
    if (typeof rhs === 'number') {
      return new Rgba(this.r * rhs, this.g * rhs, this.b * rhs, this.a * rhs);
    }
    return new Rgba(this.r * rhs.r, this.g * rhs.g, this.b * rhs.b, this.a * rhs.a);
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
        throw new RangeError(`Rgba index out of bounds: ${index}`);
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
        throw new RangeError(`Rgba index out of bounds: ${index}`);
    }
  }

  clone(): Rgba {
    return new Rgba(this.r, this.g, this.b, this.a);
  }

  equals(other: Rgba): boolean {
    return this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a;
  }

  toString(): string {
    return `Rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
  }
}

// --------------------------------------------------------------------------
// Conversions from `ecolor/src/lib.rs`, kept here next to their only users.
// --------------------------------------------------------------------------

/** gamma [0, 255] -> linear [0, 1]. */
export function linear_f32_from_gamma_u8(s: number): number {
  return s <= 10 ? s / 3294.6 : Math.pow((s + 14.025) / 269.025, 2.4);
}

/** linear [0, 255] -> linear [0, 1]. Useful for the alpha channel. */
export function linear_f32_from_linear_u8(a: number): number {
  return a / 255.0;
}

/** linear [0, 1] -> gamma [0, 255] (clamped). */
export function gamma_u8_from_linear_f32(l: number): number {
  if (l <= 0.0) {
    return 0;
  }
  if (l <= 0.0031308) {
    return fast_round(3294.6 * l);
  }
  if (l <= 1.0) {
    return fast_round(269.025 * Math.pow(l, 1.0 / 2.4) - 14.025);
  }
  return 255;
}

/** linear [0, 1] -> linear [0, 255] (clamped). Useful for the alpha channel. */
export function linear_u8_from_linear_f32(a: number): number {
  return fast_round(a * 255.0);
}

/** gamma [0, 1] -> linear [0, 1] (not clamped). */
export function linear_from_gamma(gamma: number): number {
  if (gamma < 0.0) {
    return -linear_from_gamma(-gamma);
  }
  if (gamma <= 0.04045) {
    return gamma / 12.92;
  }
  return Math.pow((gamma + 0.055) / 1.055, 2.4);
}

/** linear [0, 1] -> gamma [0, 1] (not clamped). */
export function gamma_from_linear(linear: number): number {
  if (linear < 0.0) {
    return -gamma_from_linear(-linear);
  }
  if (linear <= 0.0031308) {
    return 12.92 * linear;
  }
  return 1.055 * Math.pow(linear, 1.0 / 2.4) - 0.055;
}