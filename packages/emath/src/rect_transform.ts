/**
 * Port of `emath/src/rect_transform.rs`.
 */

import { Pos2, pos2 } from './pos2.js';
import { Rect } from './rect.js';
import { Vec2 } from './vec2.js';
import { remap, remap_clamp } from './numeric.js';

/**
 * Linearly transforms positions from one {@link Rect} to another.
 *
 * A {@link RectTransform} stores the rectangles, and therefore supports
 * clamping and culling.
 */
export class RectTransform {
  readonly from: Rect;
  readonly to: Rect;

  constructor(from: Rect, to: Rect) {
    this.from = from;
    this.to = to;
  }

  static identity(from_and_to: Rect): RectTransform {
    return new RectTransform(from_and_to, from_and_to);
  }

  static from_to(from: Rect, to: Rect): RectTransform {
    return new RectTransform(from, to);
  }

  /** The scale factors. */
  scale(): Vec2 {
    return this.to.size().div(this.from.size());
  }

  inverse(): RectTransform {
    return new RectTransform(this.to, this.from);
  }

  /** Transforms the given coordinate in the `from` space to the `to` space. */
  transform_pos(pos: Pos2): Pos2 {
    const fx = this.from.x_range();
    const tx = this.to.x_range();
    const fy = this.from.y_range();
    const ty = this.to.y_range();
    return pos2(remap(pos.x, fx.min, fx.max, tx.min, tx.max), remap(pos.y, fy.min, fy.max, ty.min, ty.max));
  }

  /** Transforms the given rectangle in the `in`-space to a rectangle in the `out`-space. */
  transform_rect(rect: Rect): Rect {
    return new Rect(this.transform_pos(rect.min), this.transform_pos(rect.max));
  }

  /**
   * Transforms the given coordinate in the `from` space to the `to` space,
   * clamping if necessary.
   */
  transform_pos_clamped(pos: Pos2): Pos2 {
    const fx = this.from.x_range();
    const tx = this.to.x_range();
    const fy = this.from.y_range();
    const ty = this.to.y_range();
    return pos2(
      remap_clamp(pos.x, fx.min, fx.max, tx.min, tx.max),
      remap_clamp(pos.y, fy.min, fy.max, ty.min, ty.max),
    );
  }

  /** Transforms the position. */
  mul(pos: Pos2): Pos2 {
    return this.transform_pos(pos);
  }

  clone(): RectTransform {
    return new RectTransform(this.from, this.to);
  }

  equals(other: RectTransform): boolean {
    return this.from.equals(other.from) && this.to.equals(other.to);
  }

  toString(): string {
    return `RectTransform { from: ${this.from}, to: ${this.to} }`;
  }
}