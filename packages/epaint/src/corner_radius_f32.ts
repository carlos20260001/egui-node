/**
 * Port of `epaint/src/corner_radius_f32.rs`.
 */

import { f32Max, f32Min } from '@egui-node/emath';
import { CornerRadius } from './corner_radius.js';
import { f32Round, sat_u8 } from './internal.js';

/**
 * How rounded the corners of things should be, in floats.
 *
 * This is used for calculations, but storage is usually done with the more
 * compact {@link CornerRadius}.
 */
export class CornerRadiusF32 {
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
  static readonly ZERO: CornerRadiusF32 = new CornerRadiusF32(0.0, 0.0, 0.0, 0.0);

  /** Same rounding on all four corners. */
  static same(radius: number): CornerRadiusF32 {
    return new CornerRadiusF32(radius, radius, radius, radius);
  }

  /** `impl From<f32> for CornerRadiusF32` */
  static from_f32(radius: number): CornerRadiusF32 {
    return CornerRadiusF32.same(radius);
  }

  /** `impl From<CornerRadius> for CornerRadiusF32` */
  static fromCornerRadius(cr: CornerRadius): CornerRadiusF32 {
    return new CornerRadiusF32(cr.nw, cr.ne, cr.sw, cr.se);
  }

  /** `impl From<CornerRadiusF32> for CornerRadius` */
  toCornerRadius(): CornerRadius {
    return new CornerRadius(
      sat_u8(f32Round(this.nw)),
      sat_u8(f32Round(this.ne)),
      sat_u8(f32Round(this.sw)),
      sat_u8(f32Round(this.se)),
    );
  }

  /** Do all corners have the same rounding? */
  is_same(): boolean {
    return this.nw === this.ne && this.nw === this.sw && this.nw === this.se;
  }

  /** Make sure each corner has a rounding of at least this. */
  at_least(min: number): CornerRadiusF32 {
    return new CornerRadiusF32(
      f32Max(this.nw, min),
      f32Max(this.ne, min),
      f32Max(this.sw, min),
      f32Max(this.se, min),
    );
  }

  /** Make sure each corner has a rounding of at most this. */
  at_most(max: number): CornerRadiusF32 {
    return new CornerRadiusF32(
      f32Min(this.nw, max),
      f32Min(this.ne, max),
      f32Min(this.sw, max),
      f32Min(this.se, max),
    );
  }

  /** Set the rounding of the two east (right) corners. */
  with_east(radius: number): CornerRadiusF32 {
    return new CornerRadiusF32(this.nw, radius, this.sw, radius);
  }

  /** Set the rounding of the two north (top) corners. */
  with_north(radius: number): CornerRadiusF32 {
    return new CornerRadiusF32(radius, radius, this.sw, this.se);
  }

  /** Set the rounding of the two south (bottom) corners. */
  with_south(radius: number): CornerRadiusF32 {
    return new CornerRadiusF32(this.nw, this.ne, radius, radius);
  }

  /** Set the rounding of the two west (left) corners. */
  with_west(radius: number): CornerRadiusF32 {
    return new CornerRadiusF32(radius, this.ne, radius, this.se);
  }

  // --------------------------------------------------------------------------
  // Operator impls. Note these saturate at zero: no corner radius goes negative.
  // --------------------------------------------------------------------------

  /** Saturates at zero. */
  add(rhs: CornerRadiusF32): CornerRadiusF32 {
    return new CornerRadiusF32(
      f32Max(this.nw + rhs.nw, 0.0),
      f32Max(this.ne + rhs.ne, 0.0),
      f32Max(this.sw + rhs.sw, 0.0),
      f32Max(this.se + rhs.se, 0.0),
    );
  }

  /** `self += rhs` where `rhs` is a scalar or another `CornerRadiusF32`. */
  add_assign(rhs: CornerRadiusF32 | number): CornerRadiusF32 {
    return this.assignFrom(
      typeof rhs === 'number' ? this.add(CornerRadiusF32.same(rhs)) : this.add(rhs),
    );
  }

  /** Saturates at zero. */
  sub(rhs: CornerRadiusF32): CornerRadiusF32 {
    return new CornerRadiusF32(
      f32Max(this.nw - rhs.nw, 0.0),
      f32Max(this.ne - rhs.ne, 0.0),
      f32Max(this.sw - rhs.sw, 0.0),
      f32Max(this.se - rhs.se, 0.0),
    );
  }

  /** `self -= rhs` where `rhs` is a scalar or another `CornerRadiusF32`. */
  sub_assign(rhs: CornerRadiusF32 | number): CornerRadiusF32 {
    return this.assignFrom(
      typeof rhs === 'number' ? this.sub(CornerRadiusF32.same(rhs)) : this.sub(rhs),
    );
  }

  div(rhs: number): CornerRadiusF32 {
    return new CornerRadiusF32(this.nw / rhs, this.ne / rhs, this.sw / rhs, this.se / rhs);
  }

  div_assign(rhs: number): CornerRadiusF32 {
    return this.assignFrom(this.div(rhs));
  }

  mul(rhs: number): CornerRadiusF32 {
    return new CornerRadiusF32(this.nw * rhs, this.ne * rhs, this.sw * rhs, this.se * rhs);
  }

  mul_assign(rhs: number): CornerRadiusF32 {
    return this.assignFrom(this.mul(rhs));
  }

  private assignFrom(other: CornerRadiusF32): CornerRadiusF32 {
    this.nw = other.nw;
    this.ne = other.ne;
    this.sw = other.sw;
    this.se = other.se;
    return this;
  }

  clone(): CornerRadiusF32 {
    return new CornerRadiusF32(this.nw, this.ne, this.sw, this.se);
  }

  equals(other: CornerRadiusF32): boolean {
    return this.nw === other.nw && this.ne === other.ne && this.sw === other.sw && this.se === other.se;
  }

  toString(): string {
    return `CornerRadiusF32 { nw: ${this.nw}, ne: ${this.ne}, sw: ${this.sw}, se: ${this.se} }`;
  }
}