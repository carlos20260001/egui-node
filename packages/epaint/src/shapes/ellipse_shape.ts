/**
 * Port of `epaint/src/shapes/ellipse_shape.rs`.
 */

import { Pos2, Rect, Rot2, Vec2, vec2 } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';
import { Stroke } from '../stroke.js';

/** How to paint an ellipse. */
export class EllipseShape {
  center: Pos2;

  /** Radius is the vector (a, b) where the width of the ellipse is 2a and the height is 2b. */
  radius: Vec2;

  fill: Color32;
  stroke: Stroke;

  /** Rotate ellipse by this many radians clockwise around its center. */
  angle: number;

  constructor(center: Pos2, radius: Vec2, fill: Color32, stroke: Stroke, angle: number = 0.0) {
    this.center = center;
    this.radius = radius;
    this.fill = fill;
    this.stroke = stroke;
    this.angle = angle;
  }

  static filled(center: Pos2, radius: Vec2, fill_color: Color32): EllipseShape {
    return new EllipseShape(center, radius, fill_color, Stroke.NONE, 0.0);
  }

  static stroke(center: Pos2, radius: Vec2, stroke: Stroke): EllipseShape {
    return new EllipseShape(center, radius, Color32.TRANSPARENT, stroke, 0.0);
  }

  /**
   * Set the rotation of the ellipse (in radians, clockwise).
   * The ellipse rotates around its center.
   */
  with_angle(angle: number): EllipseShape {
    return new EllipseShape(this.center, this.radius, this.fill, this.stroke, angle);
  }

  /**
   * Set the rotation of the ellipse (in radians, clockwise) around a custom
   * pivot point.
   */
  with_angle_and_pivot(angle: number, pivot: Pos2): EllipseShape {
    const rot = Rot2.from_angle(angle);
    const center = pivot.add(rot.mul(this.center.sub(pivot)));
    return new EllipseShape(center, this.radius, this.fill, this.stroke, angle);
  }

  /** The visual bounding rectangle (includes stroke width). */
  visual_bounding_rect(): Rect {
    if (this.fill.equals(Color32.TRANSPARENT) && this.stroke.is_empty()) {
      return Rect.NOTHING;
    }
    const rect = Rect.from_center_size(
      Pos2.ZERO,
      this.radius.mul(2.0).add(vec2(this.stroke.width, this.stroke.width)),
    );
    return rect.rotate_bb(Rot2.from_angle(this.angle)).translate(this.center.to_vec2());
  }

  clone(): EllipseShape {
    return new EllipseShape(this.center, this.radius, this.fill, this.stroke, this.angle);
  }

  equals(other: EllipseShape): boolean {
    return (
      this.center.equals(other.center) &&
      this.radius.equals(other.radius) &&
      this.fill.equals(other.fill) &&
      this.stroke.equals(other.stroke) &&
      this.angle === other.angle
    );
  }
}