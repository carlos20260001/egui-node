/**
 * Port of `ecolor/src/hsva_gamma.rs`.
 */

import { Color32 } from './color32.js';
import { Hsva } from './hsva.js';
import { Rgba, gamma_from_linear, linear_from_gamma } from './rgba.js';

/**
 * Like {@link Hsva} but with the `v` value (brightness) being gamma corrected
 * so that it is somewhat perceptually even.
 */
export class HsvaGamma {
  /** hue 0-1 */
  h: number;
  /** saturation 0-1 */
  s: number;
  /** value 0-1, in gamma-space (~perceptually even) */
  v: number;
  /** alpha 0-1. A negative value signifies an additive color (and alpha is ignored). */
  a: number;

  constructor(h: number, s: number, v: number, a: number) {
    this.h = h;
    this.s = s;
    this.v = v;
    this.a = a;
  }

  /** `impl From<HsvaGamma> for Hsva` */
  static fromHsvaGamma(hsvag: HsvaGamma): Hsva {
    return new Hsva(hsvag.h, hsvag.s, linear_from_gamma(hsvag.v), hsvag.a);
  }

  /** `impl From<Hsva> for HsvaGamma` */
  static fromHsva(hsva: Hsva): HsvaGamma {
    return new HsvaGamma(hsva.h, hsva.s, gamma_from_linear(hsva.v), hsva.a);
  }

  /** `impl From<Rgba> for HsvaGamma` */
  static fromRgba(rgba: Rgba): HsvaGamma {
    return HsvaGamma.fromHsva(Hsva.fromRgba(rgba));
  }

  /** `impl From<Color32> for HsvaGamma` */
  static fromColor32(srgba: Color32): HsvaGamma {
    return HsvaGamma.fromHsva(Hsva.fromColor32(srgba));
  }

  /** `impl From<HsvaGamma> for Hsva` */
  toHsva(): Hsva {
    return HsvaGamma.fromHsvaGamma(this);
  }

  /** `impl From<HsvaGamma> for Rgba` */
  toRgba(): Rgba {
    return this.toHsva().toRgba();
  }

  /** `impl From<HsvaGamma> for Color32` */
  toColor32(): Color32 {
    return this.toRgba().toColor32();
  }

  clone(): HsvaGamma {
    return new HsvaGamma(this.h, this.s, this.v, this.a);
  }

  equals(other: HsvaGamma): boolean {
    return this.h === other.h && this.s === other.s && this.v === other.v && this.a === other.a;
  }

  toString(): string {
    return `HsvaGamma(${this.h}, ${this.s}, ${this.v}, ${this.a})`;
  }
}