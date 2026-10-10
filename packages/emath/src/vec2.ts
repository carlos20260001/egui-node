/**
 * Port of `emath/src/vec2.rs`.
 */

// NOTE: `pos2.ts` imports `Vec2` back, so this is a cycle. That is safe in ESM
// because neither module touches the other's binding at evaluation time - only
// inside method bodies, which run long after both modules are initialised.
import { Pos2 } from './pos2.js';
import { f32Clamp, f32Max, f32Min, f32Round } from './f32util.js';
import { floor_ui, round_to_pixel_center, round_to_pixels, round_ui } from './gui_rounding.js';
import { at_least, at_most, lerp } from './numeric.js';

/**
 * A vector has a direction and length.
 * A {@link Vec2} is often used to represent a size.
 *
 * emath represents positions using {@link Pos2}.
 *
 * Normally the units are points (logical pixels).
 *
 * Rust's operator impls (`a + b`, `a * 2.0`, `a * b`) become named methods
 * here, with the same operand semantics.
 */
export class Vec2 {
  /** Rightwards. Width. */
  x: number;

  /** Downwards. Height. */
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /** Right */
  static readonly X: Vec2 = new Vec2(1.0, 0.0);
  /** Down */
  static readonly Y: Vec2 = new Vec2(0.0, 1.0);

  /** +X */
  static readonly RIGHT: Vec2 = new Vec2(1.0, 0.0);
  /** -X */
  static readonly LEFT: Vec2 = new Vec2(-1.0, 0.0);
  /** -Y */
  static readonly UP: Vec2 = new Vec2(0.0, -1.0);
  /** +Y */
  static readonly DOWN: Vec2 = new Vec2(0.0, 1.0);

  static readonly ZERO: Vec2 = new Vec2(0.0, 0.0);
  static readonly ONE: Vec2 = new Vec2(1.0, 1.0);
  static readonly INFINITY: Vec2 = new Vec2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  static readonly NAN: Vec2 = new Vec2(Number.NaN, Number.NaN);

  static new(x: number, y: number): Vec2 {
    return new Vec2(x, y);
  }

  /** From a `[f32; 2]`. */
  static fromArray(v: readonly [number, number]): Vec2 {
    return new Vec2(v[0], v[1]);
  }

  /** Set both `x` and `y` to the same value. */
  static splat(v: number): Vec2 {
    return new Vec2(v, v);
  }

  /**
   * Treat this vector as a position.
   * `v.to_pos2()` is equivalent to `Pos2::default() + v`.
   */
  to_pos2(): Pos2 {
    return new Pos2(this.x, this.y);
  }

  /** Safe normalize: returns zero if input is zero. */
  normalized(): Vec2 {
    const len = this.length();
    return len <= 0.0 ? this : this.div(len);
  }

  /** Checks if `this` has length `1.0` up to a precision of `1e-6`. */
  is_normalized(): boolean {
    return Math.abs(this.length_sq() - 1.0) < 2e-6;
  }

  /** Rotates the vector by 90°, i.e. positive X to positive Y (clockwise in egui coordinates). */
  rot90(): Vec2 {
    return new Vec2(this.y, -this.x);
  }

  length(): number {
    return Math.hypot(this.x, this.y);
  }

  length_sq(): number {
    return this.x * this.x + this.y * this.y;
  }

  /**
   * Measures the angle of the vector.
   *
   * ```
   * Vec2.ZERO.angle() === 0.0
   * Vec2.angled(0.0).angle() === 0.0
   * Vec2.angled(1.0).angle() === 1.0
   * Vec2.X.angle() === 0.0
   * Vec2.Y.angle() === 0.25 * TAU
   * Vec2.RIGHT.angle() === 0.0
   * Vec2.DOWN.angle() === 0.25 * TAU
   * Vec2.UP.angle() === -0.25 * TAU
   * ```
   */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /**
   * Create a unit vector with the given CW angle (in radians).
   * * An angle of zero gives the unit X axis.
   * * An angle of PI/4 = 90° gives the unit Y axis.
   */
  static angled(angle: number): Vec2 {
    return new Vec2(Math.cos(angle), Math.sin(angle));
  }

  floor(): Vec2 {
    return new Vec2(Math.floor(this.x), Math.floor(this.y));
  }

  round(): Vec2 {
    return new Vec2(f32Round(this.x), f32Round(this.y));
  }

  ceil(): Vec2 {
    return new Vec2(Math.ceil(this.x), Math.ceil(this.y));
  }

  abs(): Vec2 {
    return new Vec2(Math.abs(this.x), Math.abs(this.y));
  }

  /** True if all members are also finite. */
  is_finite(): boolean {
    return Number.isFinite(this.x) && Number.isFinite(this.y);
  }

  /** True if any member is NaN. */
  any_nan(): boolean {
    return Number.isNaN(this.x) || Number.isNaN(this.y);
  }

  min(other: Vec2): Vec2 {
    return new Vec2(f32Min(this.x, other.x), f32Min(this.y, other.y));
  }

  max(other: Vec2): Vec2 {
    return new Vec2(f32Max(this.x, other.x), f32Max(this.y, other.y));
  }

  /** The dot-product of two vectors. */
  dot(other: Vec2): number {
    return this.x * other.x + this.y * other.y;
  }

  /** Returns the minimum of `x` and `y`. */
  min_elem(): number {
    return f32Min(this.x, this.y);
  }

  /** Returns the maximum of `x` and `y`. */
  max_elem(): number {
    return f32Max(this.x, this.y);
  }

  /** Swizzle the axes. */
  yx(): Vec2 {
    return new Vec2(this.y, this.x);
  }

  clamp(min: Vec2, max: Vec2): Vec2 {
    return new Vec2(f32Clamp(this.x, min.x, max.x), f32Clamp(this.y, min.y, max.y));
  }

  /** `NumExt::at_least`. */
  at_least(lower_limit: Vec2): Vec2 {
    return at_least2(this, lower_limit);
  }

  /** `NumExt::at_most`. */
  at_most(upper_limit: Vec2): Vec2 {
    return at_most2(this, upper_limit);
  }

  // --------------------------------------------------------------------------
  // `core::ops::Index<usize>`
  // --------------------------------------------------------------------------

  /** `v[0]` / `v[1]`. Throws if `index > 1`, matching the Rust panic. */
  get(index: number): number {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw new RangeError(`Vec2 index out of bounds: ${index}`);
    }
  }

  /** `v[index] = value`. Throws if `index > 1`, matching the Rust panic. */
  set(index: number, value: number): void {
    switch (index) {
      case 0:
        this.x = value;
        return;
      case 1:
        this.y = value;
        return;
      default:
        throw new RangeError(`Vec2 index out of bounds: ${index}`);
    }
  }

  /** `impl From<Vec2> for [f32; 2]` */
  toArray(): [number, number] {
    return [this.x, this.y];
  }

  /** `impl From<Vec2> for (f32, f32)` */
  toTuple(): [number, number] {
    return [this.x, this.y];
  }

  // --------------------------------------------------------------------------
  // Operator impls
  // --------------------------------------------------------------------------

  /** `self - rhs` (`impl Neg for Vec2`). */
  neg(): Vec2 {
    return new Vec2(-this.x, -this.y);
  }

  /** `self + rhs` */
  add(rhs: Vec2): Vec2 {
    return new Vec2(this.x + rhs.x, this.y + rhs.y);
  }

  /** `self += rhs` */
  add_assign(rhs: Vec2): Vec2 {
    this.x += rhs.x;
    this.y += rhs.y;
    return this;
  }

  /** `self - rhs` */
  sub(rhs: Vec2): Vec2 {
    return new Vec2(this.x - rhs.x, this.y - rhs.y);
  }

  /** `self -= rhs` */
  sub_assign(rhs: Vec2): Vec2 {
    this.x -= rhs.x;
    this.y -= rhs.y;
    return this;
  }

  /**
   * `self * rhs`
   *
   * Element-wise for a `Vec2`, scalar for a `number`.
   */
  mul(rhs: Vec2 | number): Vec2 {
    if (typeof rhs === 'number') {
      return new Vec2(this.x * rhs, this.y * rhs);
    }
    return new Vec2(this.x * rhs.x, this.y * rhs.y);
  }

  /** `self *= rhs` */
  mul_assign(rhs: Vec2 | number): Vec2 {
    if (typeof rhs === 'number') {
      this.x *= rhs;
      this.y *= rhs;
    } else {
      this.x *= rhs.x;
      this.y *= rhs.y;
    }
    return this;
  }

  /**
   * `self / rhs`
   *
   * Element-wise for a `Vec2`, scalar for a `number`.
   */
  div(rhs: Vec2 | number): Vec2 {
    if (typeof rhs === 'number') {
      return new Vec2(this.x / rhs, this.y / rhs);
    }
    return new Vec2(this.x / rhs.x, this.y / rhs.y);
  }

  /** `self /= rhs` */
  div_assign(rhs: Vec2 | number): Vec2 {
    if (typeof rhs === 'number') {
      this.x /= rhs;
      this.y /= rhs;
    } else {
      this.x /= rhs.x;
      this.y /= rhs.y;
    }
    return this;
  }

  /** Rounds to an even multiple of {@link GUI_ROUNDING}. */
  round_ui(): Vec2 {
    return new Vec2(round_ui(this.x), round_ui(this.y));
  }

  /** Like {@link Vec2.round_ui}, but always rounds towards negative infinity. */
  floor_ui(): Vec2 {
    return new Vec2(floor_ui(this.x), floor_ui(this.y));
  }

  /** Rounds to an even multiple of the physical pixel size. */
  round_to_pixels(pixels_per_point: number): Vec2 {
    return new Vec2(round_to_pixels(this.x, pixels_per_point), round_to_pixels(this.y, pixels_per_point));
  }

  /** Rounds to the center of a pixel. Doesn't really make sense for a Vec2, but 🤷 */
  round_to_pixel_center(pixels_per_point: number): Vec2 {
    return new Vec2(
      round_to_pixel_center(this.x, pixels_per_point),
      round_to_pixel_center(this.y, pixels_per_point),
    );
  }

  /** Linearly interpolate towards `other`, so that `0.0 => self, 1.0 => other`. */
  lerp_to(other: Vec2, t: number): Vec2 {
    return new Vec2(lerp(this.x, other.x, t), lerp(this.y, other.y, t));
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  equals(other: Vec2): boolean {
    return this.x === other.x && this.y === other.y;
  }

  /** Rust's `impl fmt::Display for Vec2`. */
  toString(): string {
    return `[${this.x} ${this.y}]`;
  }

  /**
   * Rust's `impl fmt::Debug for Vec2` (one decimal by default).
   *
   * Caveat: for values that land exactly on a rounding tie (e.g. `1.25` with
   * one decimal) Rust rounds half-to-even while JS `toFixed` rounds half-up.
   * This is debug-only output, so we accept the divergence.
   */
  toDebug(precision?: number): string {
    const p = precision ?? 1;
    return `[${this.x.toFixed(p)} ${this.y.toFixed(p)}]`;
  }
}

/** `vec2(x, y) == Vec2::new(x, y)` */
export function vec2(x: number, y: number): Vec2 {
  return new Vec2(x, y);
}

/** `impl Mul<Vec2> for f32` */
export function scalarMulVec2(factor: number, vec: Vec2): Vec2 {
  return new Vec2(factor * vec.x, factor * vec.y);
}

/** `NumExt::at_least` for `Vec2`. */
export function at_least2(a: Vec2, lower_limit: Vec2): Vec2 {
  return new Vec2(at_least(a.x, lower_limit.x), at_least(a.y, lower_limit.y));
}

/** `NumExt::at_most` for `Vec2`. */
export function at_most2(a: Vec2, upper_limit: Vec2): Vec2 {
  return new Vec2(at_most(a.x, upper_limit.x), at_most(a.y, upper_limit.y));
}