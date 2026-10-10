/**
 * Port of `emath/src/range.rs`.
 */

import { f32Clamp, f32Max, f32Min } from './f32util.js';
import { fast_midpoint } from './numeric.js';

/**
 * Inclusive range of floats, i.e. `min..=max`.
 *
 * Rust's range syntax (`0.0..=10.0`, `5.0..`, `..=5.0`, `..`) becomes
 * constructor arguments here; see {@link Rangef.fromRangeFrom},
 * {@link Rangef.fromRangeToInclusive} and {@link Rangef.EVERYTHING}.
 */
export class Rangef {
  min: number;
  max: number;

  constructor(min: number, max: number) {
    this.min = min;
    this.max = max;
  }

  /** Infinite range that contains everything, from -inf to +inf, inclusive. */
  static readonly EVERYTHING: Rangef = new Rangef(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);

  /**
   * The inverse of {@link Rangef.EVERYTHING}: stretches from positive
   * infinity to negative infinity. Contains nothing.
   */
  static readonly NOTHING: Rangef = new Rangef(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY);

  /** An invalid {@link Rangef} filled with NaN. */
  static readonly NAN: Rangef = new Rangef(Number.NaN, Number.NaN);

  static new(min: number, max: number): Rangef {
    return new Rangef(min, max);
  }

  static point(min_and_max: number): Rangef {
    return new Rangef(min_and_max, min_and_max);
  }

  /** `impl From<RangeFrom<f32>>`: `5.0..` */
  static fromRangeFrom(start: number): Rangef {
    return new Rangef(start, Number.POSITIVE_INFINITY);
  }

  /** `impl From<RangeToInclusive<f32>>`: `..=5.0` */
  static fromRangeToInclusive(end: number): Rangef {
    return new Rangef(Number.NEGATIVE_INFINITY, end);
  }

  /** From a `[min, max]` tuple (i.e. a Rust `RangeInclusive<f32>`). */
  static fromTuple(v: readonly [number, number]): Rangef {
    return new Rangef(v[0], v[1]);
  }

  /** The length of the range, i.e. `max - min`. */
  span(): number {
    return this.max - this.min;
  }

  /** The center of the range. */
  center(): number {
    return fast_midpoint(this.min, this.max);
  }

  contains(x: number): boolean {
    return this.min <= x && x <= this.max;
  }

  /** Equivalent to `x.clamp(min, max)`. */
  clamp(x: number): number {
    return f32Clamp(x, this.min, this.max);
  }

  /** Flip `min` and `max` if needed, so that `min <= max` after. */
  as_positive(): Rangef {
    return new Rangef(f32Min(this.min, this.max), f32Max(this.min, this.max));
  }

  /** Shrink by this much on each side, keeping the center. */
  shrink(amnt: number): Rangef {
    return new Rangef(this.min + amnt, this.max - amnt);
  }

  /** Expand by this much on each side, keeping the center. */
  expand(amnt: number): Rangef {
    return new Rangef(this.min - amnt, this.max + amnt);
  }

  /** Flip the min and the max. */
  flipped(): Rangef {
    return new Rangef(this.max, this.min);
  }

  /**
   * The overlap of two ranges, i.e. the range that is contained by both.
   *
   * If the ranges do not overlap, returns a range with `span() < 0.0`.
   *
   * ```
   * new Rangef(0, 10).intersection(new Rangef(5, 15)) === new Rangef(5, 10)
   * new Rangef(0, 10).intersection(new Rangef(10, 20)) === new Rangef(10, 10)
   * new Rangef(0, 10).intersection(new Rangef(20, 30)).span() < 0
   * ```
   */
  intersection(other: Rangef): Rangef {
    return new Rangef(f32Max(this.min, other.min), f32Min(this.max, other.max));
  }

  /**
   * The smallest range that contains both ranges.
   *
   * If the ranges do not overlap, the gap between them is included too.
   *
   * ```
   * new Rangef(0, 10).union(new Rangef(5, 15)) === new Rangef(0, 15)
   * new Rangef(0, 10).union(new Rangef(20, 30)) === new Rangef(0, 30)
   * Rangef.NOTHING.union(Rangef.point(3)) === Rangef.point(3)
   * ```
   */
  union(other: Rangef): Rangef {
    return new Rangef(f32Min(this.min, other.min), f32Max(this.max, other.max));
  }

  /** Do the two ranges intersect? */
  intersects(other: Rangef): boolean {
    return other.min <= this.max && this.min <= other.max;
  }

  /** `self * factor` */
  mul(factor: number): Rangef {
    return new Rangef(this.min * factor, this.max * factor);
  }

  /** `self / factor` */
  div(factor: number): Rangef {
    return new Rangef(this.min / factor, this.max / factor);
  }

  /** `impl From<Rangef> for RangeInclusive<f32>` */
  toTuple(): [number, number] {
    return [this.min, this.max];
  }

  clone(): Rangef {
    return new Rangef(this.min, this.max);
  }

  equals(other: Rangef): boolean {
    return this.min === other.min && this.max === other.max;
  }

  toString(): string {
    return `${this.min}..=${this.max}`;
  }
}

/** `impl Mul<Rangef> for f32` */
export function scalarMulRangef(factor: number, range: Rangef): Rangef {
  return new Rangef(factor * range.min, factor * range.max);
}