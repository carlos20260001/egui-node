/**
 * Port of `epaint/src/shapes/band_shape.rs`.
 */

import { Pos2, Rangef, Rect, Rot2, TSTransform } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';
import { Stroke } from '../stroke.js';
import type { StrokeKind } from '../stroke.js';

/** A sample in a `BandShape`. */
export class BandPoint {
  /** The horizontal position of this sample. */
  x: number;

  /** The vertical extent of the band at {@link BandPoint.x}. */
  y: Rangef;

  constructor(x: number, y: Rangef) {
    this.x = x;
    this.y = y;
  }

  static new(x: number, y: Rangef): BandPoint {
    return new BandPoint(x, y);
  }

  static from_pos_and_width(pos: Pos2, width: number): BandPoint {
    const half_width = 0.5 * width;
    return new BandPoint(pos.x, new Rangef(pos.y - half_width, pos.y + half_width));
  }

  /** Whether all coordinates are finite. */
  is_finite(): boolean {
    return Number.isFinite(this.x) && Number.isFinite(this.y.min) && Number.isFinite(this.y.max);
  }

  /** Finite, and non-inverted. Rust marks this `pub(crate)`. */
  is_valid(): boolean {
    return this.is_finite() && this.y.min <= this.y.max;
  }

  clone(): BandPoint {
    return new BandPoint(this.x, this.y);
  }

  equals(other: BandPoint): boolean {
    return this.x === other.x && this.y.equals(other.y);
  }
}

/**
 * A varying-width band along a line segment.
 *
 * If you want a meandering path of fixed width, use `PathShape` instead.
 *
 * ```text
 *              min_y
 *             __________
 *            /          \________
 *     ______/                    |
 *    |                   ________|
 *    |        __________/
 *    |_______/
 *            max_y
 *
 *     x-----x-x---------x-x-------x
 * ```
 */
export class BandShape {
  /** The samples that define the lower and upper boundaries, sorted by `x`. */
  points: BandPoint[];

  /** The fill color of the band. */
  fill: Color32;

  /** An optional stroke around the band. */
  stroke: Stroke;

  /** Whether the stroke is inside, outside, or centered on the band edge. */
  stroke_kind: StrokeKind;

  /** Rotate the band by this many radians clockwise around the origin `(0, 0)`. */
  angle: number;

  constructor(points: BandPoint[], fill: Color32, stroke: Stroke, stroke_kind: StrokeKind, angle: number) {
    this.points = points;
    this.fill = fill;
    this.stroke = stroke;
    this.stroke_kind = stroke_kind;
    this.angle = angle;
  }

  static new(points: BandPoint[], fill: Color32, stroke: Stroke): BandShape {
    return new BandShape(points, fill, stroke, 'Middle', 0.0);
  }

  static filled(points: BandPoint[], fill: Color32): BandShape {
    return BandShape.new(points, fill, Stroke.NONE);
  }

  static stroke(points: BandPoint[], stroke: Stroke): BandShape {
    return BandShape.new(points, Color32.TRANSPARENT, stroke);
  }

  /** Set if the stroke is on the inside, outside, or centered on the band edge. */
  with_stroke_kind(stroke_kind: StrokeKind): BandShape {
    this.stroke_kind = stroke_kind;
    return this;
  }

  /**
   * Set the rotation of the band (in radians, clockwise) around a custom pivot
   * point.
   *
   * The band keeps the position it already had at `pivot`, so calling this again
   * with a different angle rotates around the same point.
   */
  with_angle_and_pivot(angle: number, pivot: Pos2): BandShape {
    // The points are stored pre-rotation, so undo each rotation to get the local offset:
    const translation = Rot2.from_angle(-angle).mul(pivot.to_vec2()).sub(Rot2.from_angle(-this.angle).mul(pivot.to_vec2()));
    this.angle = angle;
    for (const point of this.points) {
      point.x += translation.x;
      point.y.min += translation.y;
      point.y.max += translation.y;
    }
    return this;
  }

  /** Transform the band in-place. */
  transform(transform: TSTransform): void {
    const translation = Rot2.from_angle(-this.angle).mul(transform.translation);
    for (const point of this.points) {
      point.x = transform.scaling * point.x + translation.x;
      point.y.min = transform.scaling * point.y.min + translation.y;
      point.y.max = transform.scaling * point.y.max + translation.y;
    }
    this.stroke.width *= transform.scaling;
  }

  /** The visual bounding rectangle, including the stroke width. */
  visual_bounding_rect(): Rect {
    if (!Number.isFinite(this.angle) || (this.fill.equals(Color32.TRANSPARENT) && this.stroke.is_empty())) {
      return Rect.NOTHING;
    }

    const rect = this.local_bounding_rect();
    if (rect.equals(Rect.NOTHING)) {
      return Rect.NOTHING;
    }

    let stroke_width: number;
    switch (this.stroke_kind) {
      // A band too thin for an inside stroke is widened to fit it, so the
      // stroke can reach a full width past a pinch:
      case 'Inside':
      case 'Outside':
        stroke_width = this.stroke.width;
        break;
      default:
        stroke_width = this.stroke.width / 2.0;
        break;
    }
    return rect.expand(stroke_width).rotate_bb(Rot2.from_angle(this.angle));
  }

  private local_bounding_rect(): Rect {
    const rect = Rect.NOTHING.clone();
    // `array_windows::<2>()` yields non-overlapping adjacent pairs.
    for (let i = 0; i + 1 < this.points.length; i += 1) {
      const left = this.points[i]!;
      const right = this.points[i + 1]!;
      if (left.is_valid() && right.is_valid() && left.x < right.x) {
        rect.extend_with(new Pos2(left.x, left.y.min));
        rect.extend_with(new Pos2(left.x, left.y.max));
        rect.extend_with(new Pos2(right.x, right.y.min));
        rect.extend_with(new Pos2(right.x, right.y.max));
      }
    }
    return rect;
  }

  clone(): BandShape {
    return new BandShape(
      this.points.map((p) => p.clone()),
      this.fill,
      this.stroke,
      this.stroke_kind,
      this.angle,
    );
  }

  equals(other: BandShape): boolean {
    if (this.points.length !== other.points.length) return false;
    for (let i = 0; i < this.points.length; i++) {
      if (!this.points[i]!.equals(other.points[i]!)) return false;
    }
    return (
      this.fill.equals(other.fill) &&
      this.stroke.equals(other.stroke) &&
      this.stroke_kind === other.stroke_kind &&
      this.angle === other.angle
    );
  }
}