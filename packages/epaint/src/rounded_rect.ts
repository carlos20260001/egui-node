/**
 * Port of `epaint/src/rounded_rect.rs`.
 */

import { Pos2, Rect, Vec2, vec2 } from '@egui-node/emath';
import { CornerRadiusF32 } from './corner_radius_f32.js';

/**
 * A rectangle geometry with rounded corners.
 *
 * Not a painting primitive. For that, see `RectShape`.
 *
 * Both fields are private in Rust; the accessors below are the public surface.
 */
export class RoundedRect {
  private readonly rect_: Rect;
  private readonly corner_radius_: CornerRadiusF32;

  private constructor(rect: Rect, corner_radius: CornerRadiusF32) {
    this.rect_ = rect;
    this.corner_radius_ = corner_radius;
  }

  /** The corner radius is clamped to half the size of the rectangle. */
  static new(rect: Rect, corner_radius: CornerRadiusF32 | number): RoundedRect {
    const cr = typeof corner_radius === 'number' ? CornerRadiusF32.same(corner_radius) : corner_radius;
    const max_radius = 0.5 * rect.size().min_elem();
    return new RoundedRect(rect, cr.at_most(max_radius).at_least(0.0));
  }

  /** `impl From<Rect> for RoundedRect`: a sharp-cornered rounded rect. */
  static fromRect(rect: Rect): RoundedRect {
    return new RoundedRect(rect, CornerRadiusF32.ZERO);
  }

  rect(): Rect {
    return this.rect_;
  }

  corner_radius(): CornerRadiusF32 {
    return this.corner_radius_;
  }

  /** Split into the rectangle and the corner radius. */
  into_parts(): [Rect, CornerRadiusF32] {
    return [this.rect_, this.corner_radius_];
  }

  /** Expand the rectangle and the corner radii by the given amount. */
  expand(amount: number): RoundedRect {
    return RoundedRect.new(
      this.rect_.expand(amount),
      this.corner_radius_.add(CornerRadiusF32.same(amount)),
    );
  }

  /** Shrink the rectangle and the corner radii by the given amount. */
  shrink(amount: number): RoundedRect {
    return this.expand(-amount);
  }

  /**
   * Clamp the given position to lie within this rounded rectangle.
   *
   * Positions in the corner regions are projected onto the corner arcs.
   */
  clamp_pos(pos: Pos2): Pos2 {
    const rect = this.rect_;
    const corner_radius = this.corner_radius_;
    const clamped = rect.clamp(pos);
    const corners: [number, Vec2][] = [
      [corner_radius.nw, vec2(-1.0, -1.0)],
      [corner_radius.ne, vec2(1.0, -1.0)],
      [corner_radius.sw, vec2(-1.0, 1.0)],
      [corner_radius.se, vec2(1.0, 1.0)],
    ];
    for (const [radius, dir] of corners) {
      const arc_center = rect.center().add(dir.mul(rect.size().div(2.0).sub(vec2(radius, radius))));
      const offset = clamped.sub(arc_center);
      if (0.0 < offset.x * dir.x && 0.0 < offset.y * dir.y && radius < offset.length()) {
        return arc_center.add(offset.mul(radius / offset.length()));
      }
    }
    return clamped;
  }

  clone(): RoundedRect {
    return new RoundedRect(this.rect_, this.corner_radius_);
  }

  equals(other: RoundedRect): boolean {
    return this.rect_.equals(other.rect_) && this.corner_radius_.equals(other.corner_radius_);
  }

  toString(): string {
    return `RoundedRect { rect: ${this.rect_}, corner_radius: ${this.corner_radius_} }`;
  }
}