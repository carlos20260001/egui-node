/**
 * Port of `epaint/src/shapes/circle_shape.rs`.
 */

import { Pos2, Rect, vec2 } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';
import { Stroke } from '../stroke.js';

/** How to paint a circle. */
export class CircleShape {
  center: Pos2;
  radius: number;
  fill: Color32;
  stroke: Stroke;

  constructor(center: Pos2, radius: number, fill: Color32, stroke: Stroke) {
    this.center = center;
    this.radius = radius;
    this.fill = fill;
    this.stroke = stroke;
  }

  static filled(center: Pos2, radius: number, fill_color: Color32): CircleShape {
    return new CircleShape(center, radius, fill_color, Stroke.NONE);
  }

  static stroke(center: Pos2, radius: number, stroke: Stroke): CircleShape {
    return new CircleShape(center, radius, Color32.TRANSPARENT, stroke);
  }

  /** The visual bounding rectangle (includes stroke width). */
  visual_bounding_rect(): Rect {
    if (this.fill.equals(Color32.TRANSPARENT) && this.stroke.is_empty()) {
      return Rect.NOTHING;
    }
    const d = this.radius * 2.0 + this.stroke.width;
    return Rect.from_center_size(this.center, vec2(d, d));
  }

  clone(): CircleShape {
    return new CircleShape(this.center, this.radius, this.fill, this.stroke);
  }

  equals(other: CircleShape): boolean {
    return (
      this.center.equals(other.center) &&
      this.radius === other.radius &&
      this.fill.equals(other.fill) &&
      this.stroke.equals(other.stroke)
    );
  }
}