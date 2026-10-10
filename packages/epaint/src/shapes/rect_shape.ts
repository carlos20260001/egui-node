/**
 * Port of `epaint/src/shapes/rect_shape.rs`.
 */

import { Pos2, Rect, Rot2 } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';
import { Brush } from '../brush.js';
import { CornerRadius } from '../corner_radius.js';
import { DEFAULT_TEXTURE_ID } from '../texture_id.js';
import type { TextureId } from '../texture_id.js';
import { Stroke } from '../stroke.js';
import type { StrokeKind } from '../stroke.js';

/**
 * How to paint a rectangle.
 *
 * The `brush` field is an `Option<Arc<Brush>>` in Rust, which is why it is
 * `Brush | null` here.
 */
export class RectShape {
  rect: Rect;

  /**
   * How rounded the corners of the rectangle are. Use `CornerRadius.ZERO` for
   * sharp corners.
   */
  corner_radius: CornerRadius;

  /** How to fill the rectangle. */
  fill: Color32;

  /** The thickness and color of the outline. */
  stroke: Stroke;

  /** Is the stroke on the inside, outside, or centered on the rectangle? */
  stroke_kind: StrokeKind;

  /**
   * Snap the rectangle to pixels? If `undefined`,
   * `TessellationOptions::round_rects_to_pixels` will be used.
   */
  round_to_pixels: boolean | undefined;

  /** If larger than zero, the edges of the rectangle will be blurred. */
  blur_width: number;

  /** Controls texturing, if any. */
  brush: Brush | null;

  /** Rotate rectangle by this many radians clockwise around its center. */
  angle: number;

  constructor(
    rect: Rect,
    corner_radius: CornerRadius,
    fill: Color32,
    stroke: Stroke,
    stroke_kind: StrokeKind,
  ) {
    this.rect = rect;
    this.corner_radius = corner_radius;
    this.fill = fill;
    this.stroke = stroke;
    this.stroke_kind = stroke_kind;
    this.round_to_pixels = undefined;
    this.blur_width = 0.0;
    this.brush = null;
    this.angle = 0.0;
  }

  /** See also {@link RectShape.filled} and {@link RectShape.stroke}. */
  static new(
    rect: Rect,
    corner_radius: CornerRadius,
    fill_color: Color32,
    stroke: Stroke,
    stroke_kind: StrokeKind,
  ): RectShape {
    return new RectShape(rect, corner_radius, fill_color, stroke, stroke_kind);
  }

  static filled(rect: Rect, corner_radius: CornerRadius, fill_color: Color32): RectShape {
    return RectShape.new(rect, corner_radius, fill_color, Stroke.NONE, 'Outside'); // doesn't matter
  }

  static stroke(rect: Rect, corner_radius: CornerRadius, stroke: Stroke, stroke_kind: StrokeKind): RectShape {
    return RectShape.new(rect, corner_radius, Color32.TRANSPARENT, stroke, stroke_kind);
  }

  /** Set if the stroke is on the inside, outside, or centered on the rectangle. */
  with_stroke_kind(stroke_kind: StrokeKind): RectShape {
    this.stroke_kind = stroke_kind;
    return this;
  }

  /** Snap the rectangle to pixels? Rounding produces sharper rectangles. */
  with_round_to_pixels(round_to_pixels: boolean): RectShape {
    this.round_to_pixels = round_to_pixels;
    return this;
  }

  /**
   * If larger than zero, the edges of the rectangle (for both fill and stroke)
   * will be blurred.
   */
  with_blur_width(blur_width: number): RectShape {
    this.blur_width = blur_width;
    return this;
  }

  /** Set the texture to use when painting this rectangle, if any. */
  with_texture(fill_texture_id: TextureId, uv: Rect): RectShape {
    this.brush = new Brush(fill_texture_id, uv);
    return this;
  }

  /** Set the rotation of the rectangle (in radians, clockwise), around its center. */
  with_angle(angle: number): RectShape {
    this.angle = angle;
    return this;
  }

  /** Set the rotation of the rectangle (in radians, clockwise) around a custom pivot point. */
  with_angle_and_pivot(angle: number, pivot: Pos2): RectShape {
    this.angle = angle;
    const rot = Rot2.from_angle(angle);
    const center = this.rect.center();
    const new_center = pivot.add(rot.mul(center.sub(pivot)));
    this.rect = this.rect.translate(new_center.sub(center));
    return this;
  }

  /** The visual bounding rectangle (includes stroke width). */
  visual_bounding_rect(): Rect {
    if (this.fill.equals(Color32.TRANSPARENT) && this.stroke.is_empty()) {
      return Rect.NOTHING;
    }
    let expand: number;
    switch (this.stroke_kind) {
      case 'Inside':
        expand = 0.0;
        break;
      case 'Middle':
        expand = this.stroke.width * 0.5;
        break;
      default:
        expand = this.stroke.width;
        break;
    }
    const expanded = this.rect.expand(expand + this.blur_width * 0.5);
    if (this.angle === 0.0) {
      return expanded;
    }
    // Rotate around the rectangle's center and compute bounding box
    const center = this.rect.center();
    const rect_relative = Rect.from_center_size(Pos2.ZERO, expanded.size());
    return rect_relative.rotate_bb(Rot2.from_angle(this.angle)).translate(center.to_vec2());
  }

  /** The texture to use when painting this rectangle, if any. */
  fill_texture_id(): TextureId {
    return this.brush === null ? DEFAULT_TEXTURE_ID : this.brush.fill_texture_id;
  }

  clone(): RectShape {
    const r = new RectShape(
      this.rect,
      this.corner_radius,
      this.fill,
      this.stroke,
      this.stroke_kind,
    );
    r.round_to_pixels = this.round_to_pixels;
    r.blur_width = this.blur_width;
    r.brush = this.brush;
    r.angle = this.angle;
    return r;
  }

  equals(other: RectShape): boolean {
    return (
      this.rect.equals(other.rect) &&
      this.corner_radius.equals(other.corner_radius) &&
      this.fill.equals(other.fill) &&
      this.stroke.equals(other.stroke) &&
      this.stroke_kind === other.stroke_kind &&
      this.round_to_pixels === other.round_to_pixels &&
      this.blur_width === other.blur_width &&
      this.angle === other.angle
    );
  }
}