/**
 * Port of `epaint/src/corner_radius.rs`.
 */

import { f32Round, sat_u8, saturating_add_u8, saturating_sub_u8 } from './internal.js';

/**
 * How rounded the corners of things should be.
 *
 * This is the _corner radius_ of the underlying geometric shape (e.g.
 * rectangle). If there is a stroke, then the stroke will have an inner and
 * outer corner radius which will depend on its width and `StrokeKind`.
 *
 * The rounding uses `u8` to save space, so the amount of rounding is limited to
 * integers in the range `[0, 255]`.
 *
 * For calculations, you may want to use {@link CornerRadiusF32} instead, which
 * uses floats.
 *
 * Each field is a plain number constrained to `[0, 255]`, mirroring Rust's `u8`.
 */
export class CornerRadius {
  /** Radius of the rounding of the North-West (left top) corner. */
  nw: number;
  /** Radius of the rounding of the North-East (right top) corner. */
  ne: number;
  /** Radius of the rounding of the South-West (left bottom) corner. */
  sw: number;
  /** Radius of the rounding of the South-East (right bottom) corner. */
  se: number;

  constructor(nw: number, ne: number, sw: number, se: number) {
    this.nw = nw;
    this.ne = ne;
    this.sw = sw;
    this.se = se;
  }

  /** No rounding on any corner. */
  static readonly ZERO: CornerRadius = new CornerRadius(0, 0, 0, 0);

  /** Same rounding on all four corners. */
  static same(radius: number): CornerRadius {
    return new CornerRadius(radius, radius, radius, radius);
  }

  /** `impl From<u8> for CornerRadius` */
  static fromU8(radius: number): CornerRadius {
    return CornerRadius.same(radius);
  }

  /** `impl From<f32> for CornerRadius` */
  static from_f32(radius: number): CornerRadius {
    return CornerRadius.same(sat_u8(f32Round(radius)));
  }

  /** Do all corners have the same rounding? */
  is_same(): boolean {
    return this.nw === this.ne && this.nw === this.sw && this.nw === this.se;
  }

  /** Make sure each corner has a rounding of at least this. */
  at_least(min: number): CornerRadius {
    return new CornerRadius(
      Math.max(this.nw, min),
      Math.max(this.ne, min),
      Math.max(this.sw, min),
      Math.max(this.se, min),
    );
  }

  /** Make sure each corner has a rounding of at most this. */
  at_most(max: number): CornerRadius {
    return new CornerRadius(
      Math.min(this.nw, max),
      Math.min(this.ne, max),
      Math.min(this.sw, max),
      Math.min(this.se, max),
    );
  }

  /** Average rounding of the corners. */
  average(): number {
    return (this.nw + this.ne + this.sw + this.se) * 0.25;
  }

  // --------------------------------------------------------------------------
  // Operator impls. All saturating, per Rust's `u8` arithmetic.
  // --------------------------------------------------------------------------

  /**
   * `self + rhs`, where `rhs` is a `CornerRadius` or a `u8`.
   *
   * Saturating, per Rust's `u8` arithmetic.
   */
  add(rhs: CornerRadius | number): CornerRadius {
    if (typeof rhs === 'number') {
      return new CornerRadius(
        saturating_add_u8(this.nw, rhs),
        saturating_add_u8(this.ne, rhs),
        saturating_add_u8(this.sw, rhs),
        saturating_add_u8(this.se, rhs),
      );
    }
    return new CornerRadius(
      saturating_add_u8(this.nw, rhs.nw),
      saturating_add_u8(this.ne, rhs.ne),
      saturating_add_u8(this.sw, rhs.sw),
      saturating_add_u8(this.se, rhs.se),
    );
  }

  /** `self += rhs` where `rhs` is a `CornerRadius` or a `u8`. */
  add_assign(rhs: CornerRadius | number): CornerRadius {
    return this.assignFrom(this.add(rhs));
  }

  /**
   * `self - rhs`, where `rhs` is a `CornerRadius` or a `u8`.
   *
   * Saturating, so subtracting more than is there yields 0 rather than wrapping.
   */
  sub(rhs: CornerRadius | number): CornerRadius {
    if (typeof rhs === 'number') {
      return new CornerRadius(
        saturating_sub_u8(this.nw, rhs),
        saturating_sub_u8(this.ne, rhs),
        saturating_sub_u8(this.sw, rhs),
        saturating_sub_u8(this.se, rhs),
      );
    }
    return new CornerRadius(
      saturating_sub_u8(this.nw, rhs.nw),
      saturating_sub_u8(this.ne, rhs.ne),
      saturating_sub_u8(this.sw, rhs.sw),
      saturating_sub_u8(this.se, rhs.se),
    );
  }

  /** `self -= rhs` where `rhs` is a `CornerRadius` or a `u8`. */
  sub_assign(rhs: CornerRadius | number): CornerRadius {
    return this.assignFrom(this.sub(rhs));
  }

  /** `self / rhs` */
  div(rhs: number): CornerRadius {
    return new CornerRadius(sat_u8(this.nw / rhs), sat_u8(this.ne / rhs), sat_u8(this.sw / rhs), sat_u8(this.se / rhs));
  }

  /** `self /= rhs` */
  div_assign(rhs: number): CornerRadius {
    return this.assignFrom(this.div(rhs));
  }

  /** `self * rhs` */
  mul(rhs: number): CornerRadius {
    return new CornerRadius(sat_u8(this.nw * rhs), sat_u8(this.ne * rhs), sat_u8(this.sw * rhs), sat_u8(this.se * rhs));
  }

  /** `self *= rhs` */
  mul_assign(rhs: number): CornerRadius {
    return this.assignFrom(this.mul(rhs));
  }

  private assignFrom(other: CornerRadius): CornerRadius {
    this.nw = other.nw;
    this.ne = other.ne;
    this.sw = other.sw;
    this.se = other.se;
    return this;
  }

  clone(): CornerRadius {
    return new CornerRadius(this.nw, this.ne, this.sw, this.se);
  }

  equals(other: CornerRadius): boolean {
    return this.nw === other.nw && this.ne === other.ne && this.sw === other.sw && this.se === other.se;
  }

  toString(): string {
    return `CornerRadius { nw: ${this.nw}, ne: ${this.ne}, sw: ${this.sw}, se: ${this.se} }`;
  }
}