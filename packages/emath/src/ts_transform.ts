/**
 * Port of `emath/src/ts_transform.rs`.
 */

import { Pos2 } from './pos2.js';
import { Rect } from './rect.js';
import { Vec2, vec2 } from './vec2.js';

/**
 * Linearly transforms positions via a translation, then a scaling.
 *
 * A {@link TSTransform} first scales points with the scaling origin at `0, 0`
 * (the top left corner), then translates them.
 */
export class TSTransform {
  /** Scaling applied first, scaled around (0, 0). */
  scaling: number;

  /** Translation amount, applied after scaling. */
  translation: Vec2;

  constructor(translation: Vec2, scaling: number) {
    this.scaling = scaling;
    this.translation = translation;
  }

  static readonly IDENTITY: TSTransform = new TSTransform(vec2(0, 0), 1.0);

  /**
   * Creates a new translation that first scales points around `(0, 0)`,
   * then translates them.
   */
  static new(translation: Vec2, scaling: number): TSTransform {
    return new TSTransform(translation, scaling);
  }

  static from_translation(translation: Vec2): TSTransform {
    return new TSTransform(translation, 1.0);
  }

  static from_scaling(scaling: number): TSTransform {
    return new TSTransform(vec2(0, 0), scaling);
  }

  /** Is this a valid, invertible transform? */
  is_valid(): boolean {
    return Number.isFinite(this.scaling) && Number.isFinite(this.translation.x) && this.scaling !== 0.0;
  }

  /**
   * Inverts the transform.
   *
   * ```
   * const p1 = pos2(2.0, 3.0);
   * const p2 = pos2(12.0, 5.0);
   * const ts = TSTransform.new(vec2(2.0, 3.0), 2.0);
   * const inv = ts.inverse();
   * inv.mul_pos(p1) === pos2(0.0, 0.0)
   * inv.mul_pos(p2) === pos2(5.0, 1.0)
   * ts.inverse().inverse().equals(ts)
   * ```
   */
  inverse(): TSTransform {
    return new TSTransform(this.translation.neg().div(this.scaling), 1.0 / this.scaling);
  }

  /**
   * Transforms the given coordinate.
   *
   * ```
   * const ts = TSTransform.new(vec2(2.0, 3.0), 2.0);
   * ts.mul_pos(pos2(0.0, 0.0)) === pos2(2.0, 3.0)
   * ts.mul_pos(pos2(5.0, 1.0)) === pos2(12.0, 5.0)
   * ```
   */
  mul_pos(pos: Pos2): Pos2 {
    return pos.mul(this.scaling).add(this.translation);
  }

  /**
   * Transforms the given rectangle.
   *
   * ```
   * const rect = Rect.from_min_max(pos2(5.0, 5.0), pos2(15.0, 10.0));
   * const ts = TSTransform.new(vec2(1.0, 0.0), 3.0);
   * ts.mul_rect(rect).min === pos2(16.0, 15.0)
   * ts.mul_rect(rect).max === pos2(46.0, 30.0)
   * ```
   */
  mul_rect(rect: Rect): Rect {
    return new Rect(this.mul_pos(rect.min), this.mul_pos(rect.max));
  }

  /**
   * Applies the right hand side transform, then the left hand side.
   *
   * ```
   * const ts1 = TSTransform.new(vec2(1.0, 0.0), 2.0);
   * const ts2 = TSTransform.new(vec2(-1.0, -1.0), 3.0);
   * TSTransform.new(vec2(2.0, -1.0), 6.0).equals(ts2.mul(ts1))
   * ```
   */
  mul(rhs: TSTransform): TSTransform;
  /** Transforms the position. */
  mul(pos: Pos2): Pos2;
  /** Transforms the rectangle. */
  mul(rect: Rect): Rect;
  mul(rhs: TSTransform | Pos2 | Rect): TSTransform | Pos2 | Rect {
    if (rhs instanceof Pos2) {
      return this.mul_pos(rhs);
    }
    if (rhs instanceof Rect) {
      return this.mul_rect(rhs);
    }
    // Apply rhs first.
    return new TSTransform(
      this.translation.add(rhs.translation.mul(this.scaling)),
      this.scaling * rhs.scaling,
    );
  }

  clone(): TSTransform {
    return new TSTransform(this.translation, this.scaling);
  }

  equals(other: TSTransform): boolean {
    return this.translation.equals(other.translation) && this.scaling === other.scaling;
  }

  toString(): string {
    return `TSTransform { scaling: ${this.scaling}, translation: ${this.translation} }`;
  }
}