/**
 * Port of `emath/src/rot2.rs`.
 */

import { Vec2 } from './vec2.js';
import { f32ToDegrees } from './f32util.js';

// {s,c} represents the rotation matrix:
//
// | c -s |
// | s  c |
//
// `vec2(c,s)` represents where the X axis will end up after rotation.

/**
 * Represents a rotation in the 2D plane.
 *
 * A rotation of PI/4 = 90° rotates the X axis to the Y axis.
 *
 * Normally a {@link Rot2} is normalized (unit-length).
 * If not, it will also scale vectors.
 */
export class Rot2 {
  /** `angle.sin()` */
  readonly s: number;

  /** `angle.cos()` */
  readonly c: number;

  /**
   * Preferred construction is {@link Rot2.from_angle}; the raw `(s, c)` form
   * mirrors the private Rust fields and exists for the operator impls below.
   */
  constructor(s: number, c: number) {
    this.s = s;
    this.c = c;
  }

  /** The identity rotation: nothing rotates. */
  static readonly IDENTITY: Rot2 = new Rot2(0.0, 1.0);

  /**
   * Angle is clockwise in radians.
   * A PI/4 = 90° rotation means rotating the X axis to the Y axis.
   */
  static from_angle(angle: number): Rot2 {
    return new Rot2(Math.sin(angle), Math.cos(angle));
  }

  angle(): number {
    return Math.atan2(this.s, this.c);
  }

  /** The factor by which vectors will be scaled. */
  length(): number {
    return Math.hypot(this.c, this.s);
  }

  length_squared(): number {
    return Math.pow(this.c, 2) + Math.pow(this.s, 2);
  }

  is_finite(): boolean {
    return Number.isFinite(this.c) && Number.isFinite(this.s);
  }

  inverse(): Rot2 {
    const l = this.length_squared();
    return new Rot2(-this.s / l, this.c / l);
  }

  normalized(): Rot2 {
    const l = this.length();
    const ret = new Rot2(this.c / l, this.s / l);
    if (!ret.is_finite()) {
      throw new Error('Rot2::normalized produced a non-finite result');
    }
    return ret;
  }

  // --------------------------------------------------------------------------
  // Operator impls
  // --------------------------------------------------------------------------

  /** `self * r` - composition of two rotations. */
  mul(r: Rot2): Rot2;
  /** `self * v` - rotates (and maybe scales) the vector. */
  mul(v: Vec2): Vec2;
  /** `self * factor` - scales the rotor. */
  mul(factor: number): Rot2;
  mul(rhs: Rot2 | Vec2 | number): Rot2 | Vec2 {
    if (typeof rhs === 'number') {
      // `impl Mul<f32> for Rot2`
      return new Rot2(rhs * this.c, rhs * this.s);
    }
    if (rhs instanceof Vec2) {
      // `impl Mul<Vec2> for Rot2`
      return new Vec2(this.c * rhs.x - this.s * rhs.y, this.s * rhs.x + this.c * rhs.y);
    }
    // `impl Mul<Self> for Rot2`
    //
    // |lc -ls| * |rc -rs|
    // |ls  lc|   |rs  rc|
    return new Rot2(this.s * rhs.c + this.c * rhs.s, this.c * rhs.c - this.s * rhs.s);
  }

  equals(other: Rot2): boolean {
    return this.s === other.s && this.c === other.c;
  }

  /** Rust's `impl fmt::Debug for Rot2`. */
  toDebug(precision?: number): string {
    const p = precision ?? 1;
    return `Rot2 { angle: ${f32ToDegrees(this.angle()).toFixed(p)}°, length: ${this.length()} }`;
  }

  toString(): string {
    return this.toDebug();
  }
}

/** `impl Mul<Rot2> for f32` */
export function scalarMulRot2(factor: number, r: Rot2): Rot2 {
  return new Rot2(factor * r.s, factor * r.c);
}