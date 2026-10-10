/**
 * Port of `epaint/src/shapes/shape.rs`.
 *
 * A Rust enum with one variant per shape kind, each carrying a payload. This is
 * a tagged union; `kind` is the discriminant.
 */

import { Pos2, Rangef, Rect, Rot2, TSTransform, Vec2 } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';

import { Mesh, Vertex } from '../mesh.js';
import { DEFAULT_TEXTURE_ID } from '../texture_id.js';
import type { TextureId } from '../texture_id.js';
import { PathStroke, Stroke } from '../stroke.js';
import type { StrokeKind } from '../stroke.js';
import { CornerRadius } from '../corner_radius.js';
import type { Direction } from '../direction.js';

import { BandShape } from './band_shape.js';
import { CircleShape } from './circle_shape.js';
import { EllipseShape } from './ellipse_shape.js';
import { PathShape } from './path_shape.js';
import { RectShape } from './rect_shape.js';

export { BandPoint, BandShape } from './band_shape.js';
export { CircleShape } from './circle_shape.js';
export { EllipseShape } from './ellipse_shape.js';
export { PathShape } from './path_shape.js';
export { RectShape } from './rect_shape.js';
export { PaintCallback, PaintCallbackInfo } from './paint_callback.js';

/** Text is a separate variant; see `text_shape.ts` (not yet ported). */
export type TextShapePayload = unknown;

/** Bézier shapes are in `bezier_shape.ts` (not yet ported). */
export type BezierPayload = unknown;

/** A shape to paint. */
export type Shape =
  | { kind: 'Noop' }
  | { kind: 'Vec'; shapes: Shape[] }
  | { kind: 'Circle'; shape: CircleShape }
  | { kind: 'Ellipse'; shape: EllipseShape }
  | { kind: 'LineSegment'; points: [Pos2, Pos2]; stroke: Stroke }
  | { kind: 'Path'; shape: PathShape }
  | { kind: 'Band'; shape: BandShape }
  | { kind: 'Rect'; shape: RectShape }
  | { kind: 'Text'; shape: TextShapePayload }
  | { kind: 'Mesh'; mesh: Mesh }
  | { kind: 'QuadraticBezier'; shape: BezierPayload }
  | { kind: 'CubicBezier'; shape: BezierPayload }
  | { kind: 'Callback'; callback: unknown };

/** Paint nothing. This can be useful as a placeholder. */
export function shapeNoop(): Shape {
  return { kind: 'Noop' };
}

/** Recursively nest more shapes - sometimes a convenience. */
export function shapeVec(shapes: Shape[]): Shape {
  return { kind: 'Vec', shapes };
}

/** A line between two points. */
export function shapeLineSegment(points: [Pos2, Pos2], stroke: Stroke): Shape {
  return { kind: 'LineSegment', points, stroke };
}

/** Circle with optional outline and fill. */
export function shapeCircle(shape: CircleShape): Shape {
  return { kind: 'Circle', shape };
}

/** Ellipse with optional outline and fill. */
export function shapeEllipse(shape: EllipseShape): Shape {
  return { kind: 'Ellipse', shape };
}

/** Rectangle with optional outline and fill. */
export function shapeRect(shape: RectShape): Shape {
  return { kind: 'Rect', shape };
}

/** A series of lines between points, which can have a stroke and/or fill (if closed). */
export function shapePath(shape: PathShape): Shape {
  return { kind: 'Path', shape };
}

/** A varying-width band along a direction. */
export function shapeBand(shape: BandShape): Shape {
  return { kind: 'Band', shape };
}

/** A general triangle mesh. Can be used to display images. */
export function shapeMesh(mesh: Mesh): Shape {
  return { kind: 'Mesh', mesh };
}

// ----------------------------------------------------------------------------
// Convenience constructors
// ----------------------------------------------------------------------------

/** A horizontal line. */
export function shapeHline(x: Rangef, y: number, stroke: Stroke): Shape {
  return shapeLineSegment([new Pos2(x.min, y), new Pos2(x.max, y)], stroke);
}

/** A vertical line. */
export function shapeVline(x: number, y: Rangef, stroke: Stroke): Shape {
  return shapeLineSegment([new Pos2(x, y.min), new Pos2(x, y.max)], stroke);
}

/** A line through many points. */
export function shapeLine(points: Pos2[], stroke: PathStroke): Shape {
  return shapePath(PathShape.line(points, stroke));
}

/** A line that closes back to the start point again. */
export function shapeClosedLine(points: Pos2[], stroke: PathStroke): Shape {
  return shapePath(PathShape.closed_line(points, stroke));
}

/** A convex polygon with a fill and optional stroke. The most performant winding order is clockwise. */
export function shapeConvexPolygon(points: Pos2[], fill: Color32, stroke: PathStroke): Shape {
  return shapePath(PathShape.convex_polygon(points, fill, stroke));
}

/** A filled circle. */
export function shapeCircleFilled(center: Pos2, radius: number, fill_color: Color32): Shape {
  return shapeCircle(CircleShape.filled(center, radius, fill_color));
}

/** A circle with a stroke. */
export function shapeCircleStroke(center: Pos2, radius: number, stroke: Stroke): Shape {
  return shapeCircle(CircleShape.stroke(center, radius, stroke));
}

/** A filled ellipse. */
export function shapeEllipseFilled(center: Pos2, radius: Vec2, fill_color: Color32): Shape {
  return shapeEllipse(EllipseShape.filled(center, radius, fill_color));
}

/** An ellipse with a stroke. */
export function shapeEllipseStroke(center: Pos2, radius: Vec2, stroke: Stroke): Shape {
  return shapeEllipse(EllipseShape.stroke(center, radius, stroke));
}

/** A filled rectangle. See also {@link shapeRectStroke}. */
export function shapeRectFilled(rect: Rect, corner_radius: CornerRadius, fill_color: Color32): Shape {
  return shapeRect(RectShape.filled(rect, corner_radius, fill_color));
}

/** A rectangle with a stroke. See also {@link shapeRectFilled}. */
export function shapeRectStroke(
  rect: Rect,
  corner_radius: CornerRadius,
  stroke: Stroke,
  stroke_kind: StrokeKind,
): Shape {
  return shapeRect(RectShape.stroke(rect, corner_radius, stroke, stroke_kind));
}

/**
 * A filled triangle inscribed in `rect`, pointing down.
 *
 * `rotation` is in radians, and rotates the triangle around the center of
 * `rect`: `0.0` points down, `TAU / 4.0` left, `TAU / 2.0` up, and
 * `-TAU / 4.0` right.
 */
export function shapeRotatedTriangle(rect: Rect, rotation: number, fill: Color32): Shape {
  const rot = Rot2.from_angle(rotation);
  const center = rect.center();
  const points = [rect.left_top(), rect.right_top(), rect.center_bottom()].map((point) =>
    center.add(rot.mul(point.sub(center))),
  );
  return shapeConvexPolygon(points, fill, PathStroke.NONE);
}

/**
 * Paints a gradient rectangle that transitions from `color_from` to `color_to`
 * along the given `direction`.
 *
 * For example, `Direction.TopDown` paints `color_from` at the top edge fading
 * to `color_to` at the bottom edge.
 */
export function shapeGradientRect(rect: Rect, direction: Direction, colors: [Color32, Color32]): Shape {
  const [from, to] = colors;
  let left_top: Color32;
  let right_top: Color32;
  let left_bottom: Color32;
  let right_bottom: Color32;
  switch (direction) {
    case 'TopDown':
      [left_top, right_top, left_bottom, right_bottom] = [from, from, to, to];
      break;
    case 'BottomUp':
      [left_top, right_top, left_bottom, right_bottom] = [to, to, from, from];
      break;
    case 'LeftToRight':
      [left_top, right_top, left_bottom, right_bottom] = [from, to, from, to];
      break;
    default:
      [left_top, right_top, left_bottom, right_bottom] = [to, from, to, from];
      break;
  }

  return shapeMesh(
    new Mesh(DEFAULT_TEXTURE_ID, [
      Vertex.untextured(rect.left_top(), left_top),
      Vertex.untextured(rect.right_top(), right_top),
      Vertex.untextured(rect.left_bottom(), left_bottom),
      Vertex.untextured(rect.right_bottom(), right_bottom),
    ], [0, 1, 2, 2, 1, 3]),
  );
}

/** A textured quad, e.g. an image. */
export function shapeImage(texture_id: TextureId, rect: Rect, uv: Rect, tint: Color32): Shape {
  const mesh = new Mesh(texture_id);
  mesh.add_rect_with_uv(rect, uv, tint);
  return shapeMesh(mesh);
}

// ----------------------------------------------------------------------------
// Inspection and transforms
// ----------------------------------------------------------------------------

/** The visual bounding rectangle of this shape. */
export function visual_bounding_rect(shape: Shape): Rect {
  switch (shape.kind) {
    case 'Noop':
      return Rect.NOTHING;
    case 'Vec': {
      let rect = Rect.NOTHING.clone();
      for (const s of shape.shapes) {
        rect = rect.union(visual_bounding_rect(s));
      }
      return rect;
    }
    case 'Circle':
      return shape.shape.visual_bounding_rect();
    case 'Ellipse':
      return shape.shape.visual_bounding_rect();
    case 'LineSegment':
      return shape.stroke.is_empty()
        ? Rect.NOTHING
        : Rect.from_two_pos(shape.points[0], shape.points[1]).expand(shape.stroke.width * 0.5);
    case 'Path':
      return shape.shape.visual_bounding_rect();
    case 'Band':
      return shape.shape.visual_bounding_rect();
    case 'Rect':
      return shape.shape.visual_bounding_rect();
    case 'Text':
      return (shape.shape as { visual_bounding_rect(): Rect }).visual_bounding_rect();
    case 'Mesh':
      return shape.mesh.calc_bounds();
    case 'QuadraticBezier':
    case 'CubicBezier':
      return (shape.shape as { visual_bounding_rect(): Rect }).visual_bounding_rect();
    case 'Callback':
      return (shape.callback as { rect: Rect }).rect;
  }
}

/** The texture this shape paints with, or the default if it is untextured. */
export function shape_texture_id(shape: Shape): TextureId {
  if (shape.kind === 'Mesh') {
    return shape.mesh.texture_id;
  }
  if (shape.kind === 'Rect') {
    return shape.shape.fill_texture_id();
  }
  return DEFAULT_TEXTURE_ID;
}

/** Scale the shape by `factor`, in-place. */
export function scale(shape: Shape, factor: number): void {
  transform(shape, TSTransform.from_scaling(factor));
}

/** Move the shape by `delta`, in-place. */
export function translate(shape: Shape, delta: Vec2): void {
  transform(shape, TSTransform.from_translation(delta));
}

/** Transform (move/scale) the shape in-place. */
export function transform(shape: Shape, ts: TSTransform): void {
  switch (shape.kind) {
    case 'Noop':
      return;
    case 'Vec':
      for (const s of shape.shapes) {
        transform(s, ts);
      }
      return;
    case 'Circle': {
      const c = shape.shape;
      c.center = ts.mul_pos(c.center);
      c.radius *= ts.scaling;
      c.stroke.width *= ts.scaling;
      return;
    }
    case 'Ellipse': {
      const e = shape.shape;
      e.center = ts.mul_pos(e.center);
      e.radius = e.radius.mul(ts.scaling);
      e.stroke.width *= ts.scaling;
      return;
    }
    case 'LineSegment': {
      shape.points[0] = ts.mul_pos(shape.points[0]);
      shape.points[1] = ts.mul_pos(shape.points[1]);
      shape.stroke.width *= ts.scaling;
      return;
    }
    case 'Path': {
      const p = shape.shape;
      for (let i = 0; i < p.points.length; i++) {
        p.points[i] = ts.mul_pos(p.points[i]!);
      }
      p.stroke.width *= ts.scaling;
      return;
    }
    case 'Band':
      shape.shape.transform(ts);
      return;
    case 'Rect': {
      const r = shape.shape;
      r.rect = ts.mul_rect(r.rect);
      r.corner_radius = r.corner_radius.mul(ts.scaling);
      r.stroke.width *= ts.scaling;
      r.blur_width *= ts.scaling;
      return;
    }
    case 'Text':
      (shape.shape as { transform(ts: TSTransform): void }).transform(ts);
      return;
    case 'Mesh':
      shape.mesh.transform(ts);
      return;
    case 'QuadraticBezier':
    case 'CubicBezier':
      (shape.shape as { transform(ts: TSTransform): void }).transform(ts);
      return;
    case 'Callback': {
      // Only the rect is scaled, as opposed to other shapes where the stroke is
      // also scaled.
      const cb = shape.callback as { rect: Rect };
      cb.rect = ts.mul_rect(cb.rect);
      return;
    }
  }
}

/** Rust's `PartialEq for Shape`. */
export function shapeEquals(a: Shape, b: Shape): boolean {
  switch (a.kind) {
    case 'Noop':
      return b.kind === 'Noop';
    case 'Vec':
      return b.kind === 'Vec' && shapeSeqEquals(a.shapes, b.shapes);
    case 'Circle':
      return b.kind === 'Circle' && a.shape.equals(b.shape);
    case 'Ellipse':
      return b.kind === 'Ellipse' && a.shape.equals(b.shape);
    case 'LineSegment':
      return (
        b.kind === 'LineSegment' &&
        a.points[0].equals(b.points[0]) &&
        a.points[1].equals(b.points[1]) &&
        a.stroke.equals(b.stroke)
      );
    case 'Path':
      return b.kind === 'Path' && a.shape.equals(b.shape);
    case 'Band':
      return b.kind === 'Band' && a.shape.equals(b.shape);
    case 'Rect':
      return b.kind === 'Rect' && a.shape.equals(b.shape);
    case 'Text':
    case 'QuadraticBezier':
    case 'CubicBezier':
    case 'Callback':
      // Not yet ported upstream-side; Rust compares these by value.
      return false;
    case 'Mesh':
      return b.kind === 'Mesh' && a.mesh.equals(b.mesh);
  }
}

function shapeSeqEquals(a: Shape[], b: Shape[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => shapeEquals(s, b[i]!));
}

/** Convenience: a dotted line, turned into a list of small filled circles. */
export function shapeDottedLine(
  path: Pos2[],
  color: Color32,
  spacing: number,
  radius: number,
): Shape[] {
  const shapes: Shape[] = [];
  pointsFromLine(path, spacing, radius, color, shapes);
  return shapes;
}

/** Turn a line into dashes. */
export function shapeDashedLine(
  path: Pos2[],
  stroke: Stroke,
  dash_length: number,
  gap_length: number,
): Shape[] {
  const shapes: Shape[] = [];
  dashesFromLine(path, stroke, [dash_length], [gap_length], shapes, 0);
  return shapes;
}

/** Turn a line into dashes with different dash/gap lengths and a start offset. */
export function shapeDashedLineWithOffset(
  path: Pos2[],
  stroke: Stroke,
  dash_lengths: number[],
  gap_lengths: number[],
  dash_offset: number,
): Shape[] {
  const shapes: Shape[] = [];
  dashesFromLine(path, stroke, dash_lengths, gap_lengths, shapes, dash_offset);
  return shapes;
}

/**
 * Turn a line into dashes.
 *
 * If you need to create many dashed lines use this instead of
 * {@link shapeDashedLine}, to avoid reallocating the output vector.
 */
export function shapeDashedLineMany(
  points: Pos2[],
  stroke: Stroke,
  dash_length: number,
  gap_length: number,
  shapes: Shape[],
): void {
  dashesFromLine(points, stroke, [dash_length], [gap_length], shapes, 0);
}

/**
 * Turn a line into dashes with different dash/gap lengths and a start offset.
 *
 * If you need to create many dashed lines use this instead of
 * {@link shapeDashedLineWithOffset}.
 */
export function shapeDashedLineManyWithOffset(
  points: Pos2[],
  stroke: Stroke,
  dash_lengths: number[],
  gap_lengths: number[],
  dash_offset: number,
  shapes: Shape[],
): void {
  dashesFromLine(points, stroke, dash_lengths, gap_lengths, shapes, dash_offset);
}

// ----------------------------------------------------------------------------
// Helpers from `shape.rs` (private there)
// ----------------------------------------------------------------------------

function pointsFromLine(
  path: Pos2[],
  spacing: number,
  radius: number,
  color: Color32,
  shapes: Shape[],
): void {
  let position_on_segment = 0.0;
  for (let i = 0; i + 1 < path.length; i++) {
    const start = path[i]!;
    const end = path[i + 1]!;
    const vector = end.sub(start);
    const segment_length = vector.length();
    while (position_on_segment < segment_length) {
      const new_point = start.add(vector.mul(position_on_segment / segment_length));
      shapes.push(shapeCircleFilled(new_point, radius, color));
      position_on_segment += spacing;
    }
    position_on_segment -= segment_length;
  }
}

/** Creates dashes from a line. */
function dashesFromLine(
  path: Pos2[],
  stroke: Stroke,
  dash_lengths: number[],
  gap_lengths: number[],
  shapes: Shape[],
  dash_offset: number,
): void {
  if (dash_lengths.length !== gap_lengths.length) {
    throw new Error(
      `Mismatched dash and gap lengths, got dash_lengths: ${dash_lengths.length}, gap_lengths: ${gap_lengths.length}`,
    );
  }
  let position_on_segment = dash_offset;
  let drawing_dash = false;
  let step = 0;
  const steps = dash_lengths.length;
  for (let i = 0; i + 1 < path.length; i++) {
    const start = path[i]!;
    const end = path[i + 1]!;
    const vector = end.sub(start);
    const segment_length = vector.length();

    let start_point = start;
    while (position_on_segment < segment_length) {
      const new_point = start.add(vector.mul(position_on_segment / segment_length));
      if (drawing_dash) {
        // This is the end point.
        shapes.push(shapeLineSegment([start_point, new_point], stroke));
        position_on_segment += gap_lengths[step] ?? 0;
        // Increment step counter
        step += 1;
        if (step >= steps) {
          step = 0;
        }
      } else {
        // Start a new dash.
        start_point = new_point;
        position_on_segment += dash_lengths[step] ?? 0;
      }
      drawing_dash = !drawing_dash;
    }

    // If the segment ends and the dash is not finished, add the segment's end point.
    if (drawing_dash) {
      shapes.push(shapeLineSegment([start_point, end], stroke));
    }

    position_on_segment -= segment_length;
  }
}