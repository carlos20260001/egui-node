/**
 * Port of `emath/src/pos2.rs`.
 */

import { Vec2 } from './vec2.js';
import { f32Clamp, f32Max, f32Min, f32Round } from './f32util.js';
import { floor_ui, round_to_pixel_center, round_to_pixels, round_ui } from './gui_rounding.js';
import { at_least, at_most, lerp } from './numeric.js';

/**
 * A position on screen.
 *
 * Normally given in points (logical pixels).
 *
 * Mathematically this is known as a "point", but the term position was chosen
 * so not to conflict with the unit (one point = X physical pixels).
 *
 * Note the asymmetric arithmetic, exactly as in Rust: `Pos2 + Vec2`,
 * `Pos2 - Pos2` and `Pos2 - Vec2` are all valid, with different result types.
 */
export class Pos2 {
  /** How far to the right. */
  x: number;

  /** How far down. */
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * The zero position, the origin.
   * The top left corner in a GUI.
   * Same as `new Pos2(0, 0)`.
   */
  static readonly ZERO: Pos2 = new Pos2(0.0, 0.0);
  static readonly NAN: Pos2 = new Pos2(Number.NaN, Number.NaN);

  static new(x: number, y: number): Pos2 {
    return new Pos2(x, y);
  }

  /** From a `[f32; 2]`. */
  static fromArray(v: readonly [number, number]): Pos2 {
    return new Pos2(v[0], v[1]);
  }

  /**
   * The vector from origin to this position.
   * `p.to_vec2()` is equivalent to `p - Pos2::default()`.
   */
  to_vec2(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  distance(other: Pos2): number {
    return this.sub(other).length();
  }

  distance_sq(other: Pos2): number {
    return this.sub(other).length_sq();
  }

  floor(): Pos2 {
    return new Pos2(Math.floor(this.x), Math.floor(this.y));
  }

  round(): Pos2 {
    return new Pos2(f32Round(this.x), f32Round(this.y));
  }

  ceil(): Pos2 {
    return new Pos2(Math.ceil(this.x), Math.ceil(this.y));
  }

  /** True if all members are also finite. */
  is_finite(): boolean {
    return Number.isFinite(this.x) && Number.isFinite(this.y);
  }

  /** True if any member is NaN. */
  any_nan(): boolean {
    return Number.isNaN(this.x) || Number.isNaN(this.y);
  }

  min(other: Pos2): Pos2 {
    return new Pos2(f32Min(this.x, other.x), f32Min(this.y, other.y));
  }

  max(other: Pos2): Pos2 {
    return new Pos2(f32Max(this.x, other.x), f32Max(this.y, other.y));
  }

  clamp(min: Pos2, max: Pos2): Pos2 {
    return new Pos2(f32Clamp(this.x, min.x, max.x), f32Clamp(this.y, min.y, max.y));
  }

  /** Rounds to an even multiple of {@link GUI_ROUNDING}. */
  round_ui(): Pos2 {
    return new Pos2(round_ui(this.x), round_ui(this.y));
  }

  /** Like {@link Pos2.round_ui}, but always rounds towards negative infinity. */
  floor_ui(): Pos2 {
    return new Pos2(floor_ui(this.x), floor_ui(this.y));
  }

  /** Rounds to an even multiple of the physical pixel size. */
  round_to_pixels(pixels_per_point: number): Pos2 {
    return new Pos2(round_to_pixels(this.x, pixels_per_point), round_to_pixels(this.y, pixels_per_point));
  }

  /** Rounds to the center of a pixel. */
  round_to_pixel_center(pixels_per_point: number): Pos2 {
    return new Pos2(
      round_to_pixel_center(this.x, pixels_per_point),
      round_to_pixel_center(this.y, pixels_per_point),
    );
  }

  /** Linearly interpolate towards another point, so that `0.0 => this, 1.0 => other`. */
  lerp_to(other: Pos2, t: number): Pos2 {
    return new Pos2(lerp(this.x, other.x, t), lerp(this.y, other.y, t));
  }

  /** `NumExt::at_least`. */
  at_least(lower_limit: Pos2): Pos2 {
    return new Pos2(at_least(this.x, lower_limit.x), at_least(this.y, lower_limit.y));
  }

  /** `NumExt::at_most`. */
  at_most(upper_limit: Pos2): Pos2 {
    return new Pos2(at_most(this.x, upper_limit.x), at_most(this.y, upper_limit.y));
  }

  // --------------------------------------------------------------------------
  // `core::ops::Index<usize>`
  // --------------------------------------------------------------------------

  /** `p[0]` / `p[1]`. Throws if `index > 1`, matching the Rust panic. */
  get(index: number): number {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw new RangeError(`Pos2 index out of bounds: ${index}`);
    }
  }

  /** `p[index] = value`. Throws if `index > 1`, matching the Rust panic. */
  set(index: number, value: number): void {
    switch (index) {
      case 0:
        this.x = value;
        return;
      case 1:
        this.y = value;
        return;
      default:
        throw new RangeError(`Pos2 index out of bounds: ${index}`);
    }
  }

  /** `impl From<Pos2> for [f32; 2]` */
  toArray(): [number, number] {
    return [this.x, this.y];
  }

  /** `impl From<Pos2> for (f32, f32)` */
  toTuple(): [number, number] {
    return [this.x, this.y];
  }

  // --------------------------------------------------------------------------
  // Operator impls
  // --------------------------------------------------------------------------

  /** `self + rhs` where `rhs` is a `Vec2`. */
  add(rhs: Vec2): Pos2 {
    return new Pos2(this.x + rhs.x, this.y + rhs.y);
  }

  /** `self += rhs` where `rhs` is a `Vec2`. */
  add_assign(rhs: Vec2): Pos2 {
    this.x += rhs.x;
    this.y += rhs.y;
    return this;
  }

  /** `self - rhs` where `rhs` is a `Pos2`, yielding a `Vec2`. */
  sub(rhs: Pos2): Vec2;
  /** `self - rhs` where `rhs` is a `Vec2`, yielding a `Pos2`. */
  sub(rhs: Vec2): Pos2;
  sub(rhs: Pos2 | Vec2): Vec2 | Pos2 {
    if (rhs instanceof Pos2) {
      return new Vec2(this.x - rhs.x, this.y - rhs.y);
    }
    return new Pos2(this.x - rhs.x, this.y - rhs.y);
  }

  /** `self -= rhs` where `rhs` is a `Vec2`. */
  sub_assign(rhs: Vec2): Pos2 {
    this.x -= rhs.x;
    this.y -= rhs.y;
    return this;
  }

  /** `self * factor` */
  mul(factor: number): Pos2 {
    return new Pos2(this.x * factor, this.y * factor);
  }

  /** `self *= factor` */
  mul_assign(factor: number): Pos2 {
    this.x *= factor;
    this.y *= factor;
    return this;
  }

  /** `self / factor` */
  div(factor: number): Pos2 {
    return new Pos2(this.x / factor, this.y / factor);
  }

  clone(): Pos2 {
    return new Pos2(this.x, this.y);
  }

  equals(other: Pos2): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /** Rust's `impl fmt::Display for Pos2`. */
  toString(): string {
    return `[${this.x} ${this.y}]`;
  }

  /** Rust's `impl fmt::Debug for Pos2` (one decimal by default). */
  toDebug(precision?: number): string {
    const p = precision ?? 1;
    return `[${this.x.toFixed(p)} ${this.y.toFixed(p)}]`;
  }
}

/** `pos2(x, y) == Pos2::new(x, y)` */
export function pos2(x: number, y: number): Pos2 {
  return new Pos2(x, y);
}

/** `impl Mul<Pos2> for f32` */
export function scalarMulPos2(factor: number, vec: Pos2): Pos2 {
  return new Pos2(factor * vec.x, factor * vec.y);
}

/** `impl From<Vec2> for Pos2`, where `Pos2::default()` is the origin. */
export function pos2FromVec2(v: Vec2): Pos2 {
  return new Pos2(v.x, v.y);
}