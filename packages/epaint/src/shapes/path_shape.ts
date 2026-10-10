/**
 * Port of `epaint/src/shapes/path_shape.rs`.
 */

import { Pos2, Rect } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';
import { PathStroke } from '../stroke.js';

/**
 * A path which can be stroked and/or filled (if closed).
 *
 * If you want a path of varying width, use `BandShape` instead.
 */
export class PathShape {
  /** Filled paths should prefer clockwise order. */
  points: Pos2[];

  /** If true, connect the first and last of the points together. */
  closed: boolean;

  /** Fill is only supported for convex polygons. */
  fill: Color32;

  /** Color and thickness of the line. */
  stroke: PathStroke;

  constructor(points: Pos2[], closed: boolean, fill: Color32, stroke: PathStroke) {
    this.points = points;
    this.closed = closed;
    this.fill = fill;
    this.stroke = stroke;
  }

  /** A line through many points. */
  static line(points: Pos2[], stroke: PathStroke): PathShape {
    return new PathShape(points, false, Color32.TRANSPARENT, stroke);
  }

  /** A line that closes back to the start point again. */
  static closed_line(points: Pos2[], stroke: PathStroke): PathShape {
    return new PathShape(points, true, Color32.TRANSPARENT, stroke);
  }

  /** A convex polygon with a fill and optional stroke. */
  static convex_polygon(points: Pos2[], fill: Color32, stroke: PathStroke): PathShape {
    return new PathShape(points, true, fill, stroke);
  }

  /** The visual bounding rectangle (includes stroke width). */
  visual_bounding_rect(): Rect {
    if (this.fill.equals(Color32.TRANSPARENT) && this.stroke.is_empty()) {
      return Rect.NOTHING;
    }
    return Rect.from_points(this.points).expand(this.stroke.width * 0.5);
  }

  clone(): PathShape {
    return new PathShape([...this.points], this.closed, this.fill, this.stroke);
  }

  equals(other: PathShape): boolean {
    if (this.points.length !== other.points.length) return false;
    for (let i = 0; i < this.points.length; i++) {
      if (!this.points[i]!.equals(other.points[i]!)) return false;
    }
    return (
      this.closed === other.closed && this.fill.equals(other.fill) && this.stroke.equals(other.stroke)
    );
  }
}