/**
 * Port of `ecolor/src/hsva.rs`.
 */

import { Color32 } from './color32.js';
import { Rgba, gamma_u8_from_linear_f32, linear_f32_from_gamma_u8, linear_u8_from_linear_f32 } from './rgba.js';

/**
 * Hue, saturation, value, alpha. All in the range [0, 1].
 * No premultiplied alpha.
 */
export class Hsva {
  /** hue 0-1 */
  h: number;
  /** saturation 0-1 */
  s: number;
  /** value 0-1 */
  v: number;
  /** alpha 0-1. A negative value signifies an additive color (and alpha is ignored). */
  a: number;

  constructor(h: number, s: number, v: number, a: number) {
    this.h = h;
    this.s = s;
    this.v = v;
    this.a = a;
  }

  static new(h: number, s: number, v: number, a: number): Hsva {
    return new Hsva(h, s, v, a);
  }

  /** From `sRGBA` with premultiplied alpha */
  static from_srgba_premultiplied(rgba: readonly [number, number, number, number]): Hsva {
    return Hsva.fromColor32(Color32.from_rgba_premultiplied(rgba[0], rgba[1], rgba[2], rgba[3]));
  }

  /** From `sRGBA` without premultiplied alpha */
  static from_srgba_unmultiplied(rgba: readonly [number, number, number, number]): Hsva {
    return Hsva.fromColor32(Color32.from_rgba_unmultiplied(rgba[0], rgba[1], rgba[2], rgba[3]));
  }

  /** From linear RGBA with premultiplied alpha */
  static from_rgba_premultiplied(r: number, g: number, b: number, a: number): Hsva {
    if (a <= 0.0) {
      if (r === 0.0 && b === 0.0 && a === 0.0) {
        return new Hsva(0, 0, 0, 0);
      }
      return Hsva.from_additive_rgb([r, g, b]);
    }
    const [h, s, v] = hsv_from_rgb([r / a, g / a, b / a]);
    return new Hsva(h, s, v, a);
  }

  /** From linear RGBA without premultiplied alpha */
  static from_rgba_unmultiplied(r: number, g: number, b: number, a: number): Hsva {
    const [h, s, v] = hsv_from_rgb([r, g, b]);
    return new Hsva(h, s, v, a);
  }

  static from_additive_rgb(rgb: readonly [number, number, number]): Hsva {
    const [h, s, v] = hsv_from_rgb(rgb);
    return new Hsva(h, s, v, -0.5); // anything negative is treated as additive
  }

  static from_additive_srgb(rgb: readonly [number, number, number]): Hsva {
    return Hsva.from_additive_rgb([
      linear_f32_from_gamma_u8(rgb[0]),
      linear_f32_from_gamma_u8(rgb[1]),
      linear_f32_from_gamma_u8(rgb[2]),
    ]);
  }

  static from_rgb(rgb: readonly [number, number, number]): Hsva {
    const [h, s, v] = hsv_from_rgb(rgb);
    return new Hsva(h, s, v, 1.0);
  }

  static from_srgb(rgb: readonly [number, number, number]): Hsva {
    return Hsva.from_rgb([
      linear_f32_from_gamma_u8(rgb[0]),
      linear_f32_from_gamma_u8(rgb[1]),
      linear_f32_from_gamma_u8(rgb[2]),
    ]);
  }

  /** `impl From<Color32> for Hsva` */
  static fromColor32(srgba: Color32): Hsva {
    return Hsva.fromRgba(Rgba.fromColor32(srgba));
  }

  /** `impl From<Rgba> for Hsva` */
  static fromRgba(rgba: Rgba): Hsva {
    return Hsva.from_rgba_premultiplied(rgba.r, rgba.g, rgba.b, rgba.a);
  }

  /** `impl From<Hsva> for Rgba` */
  toRgba(): Rgba {
    return Rgba.fromArray(this.to_rgba_premultiplied());
  }

  /** `impl From<Hsva> for Color32` */
  toColor32(): Color32 {
    return this.toRgba().toColor32();
  }

  // ------------------------------------------------------------------------

  to_opaque(): Hsva {
    return new Hsva(this.h, this.s, this.v, 1.0);
  }

  to_rgb(): [number, number, number] {
    return rgb_from_hsv([this.h, this.s, this.v]);
  }

  to_srgb(): [number, number, number] {
    const [r, g, b] = this.to_rgb();
    return [gamma_u8_from_linear_f32(r), gamma_u8_from_linear_f32(g), gamma_u8_from_linear_f32(b)];
  }

  to_rgba_premultiplied(): [number, number, number, number] {
    const [r, g, b, a] = this.to_rgba_unmultiplied();
    const additive = a < 0.0;
    if (additive) {
      return [r, g, b, 0.0];
    }
    return [a * r, a * g, a * b, a];
  }

  /**
   * To linear space rgba in 0-1 range.
   *
   * Represents additive colors using a negative alpha.
   */
  to_rgba_unmultiplied(): [number, number, number, number] {
    const { h, s, v, a } = this;
    const [r, g, b] = rgb_from_hsv([h, s, v]);
    return [r, g, b, a];
  }

  to_srgba_premultiplied(): [number, number, number, number] {
    return this.toColor32().to_array();
  }

  /** To gamma-space 0-255. */
  to_srgba_unmultiplied(): [number, number, number, number] {
    const [r, g, b, a] = this.to_rgba_unmultiplied();
    return [
      gamma_u8_from_linear_f32(r),
      gamma_u8_from_linear_f32(g),
      gamma_u8_from_linear_f32(b),
      linear_u8_from_linear_f32(Math.abs(a)),
    ];
  }

  clone(): Hsva {
    return new Hsva(this.h, this.s, this.v, this.a);
  }

  equals(other: Hsva): boolean {
    return this.h === other.h && this.s === other.s && this.v === other.v && this.a === other.a;
  }

  toString(): string {
    return `Hsva(${this.h}, ${this.s}, ${this.v}, ${this.a})`;
  }
}

/** Rust `f32::fract`: always in `[0, 1)`, including for negative input. */
function fract(x: number): number {
  return x - Math.floor(x);
}

/** All ranges in 0-1, rgb is linear. */
export function hsv_from_rgb(rgb: readonly [number, number, number]): [number, number, number] {
  const [r, g, b] = rgb;
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b); // value

  const range = max - min;

  let h: number;
  if (max === min) {
    h = 0.0; // hue is undefined
  } else if (max === r) {
    h = (g - b) / (6.0 * range);
  } else if (max === g) {
    h = (b - r) / (6.0 * range) + 1.0 / 3.0;
  } else {
    // max == b
    h = (r - g) / (6.0 * range) + 2.0 / 3.0;
  }
  h = fract(h + 1.0); // wrap
  const s = max === 0.0 ? 0.0 : 1.0 - min / max;
  return [h, s, max];
}

/** All ranges in 0-1, rgb is linear. */
export function rgb_from_hsv(hsv: readonly [number, number, number]): [number, number, number] {
  // Rust shadows `h` with `let h = (h.fract() + 1.0).fract();`. Shadowing a
  // parameter with a `let` of the same name is a TDZ error in JS, so the local
  // gets its own name here.
  let h = fract(fract(hsv[0]) + 1.0); // wrap
  const s = Math.min(Math.max(hsv[1], 0.0), 1.0);
  const v = hsv[2];

  const f = h * 6.0 - Math.floor(h * 6.0);
  const p = v * (1.0 - s);
  const q = v * (1.0 - f * s);
  const t = v * (1.0 - (1.0 - f) * s);

  // Rust's `as i32` saturates, and `%` keeps the sign of the dividend. After the
  // wrap above `h * 6` is in [0, 6), so the value is always 0..=5.
  const sector = Math.trunc(Math.floor(h * 6.0)) % 6;
  switch (sector) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}