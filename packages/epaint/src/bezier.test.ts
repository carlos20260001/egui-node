import { describe, expect, it } from 'vitest';

import { Pos2, Rect, RectTransform, pos2 } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';

import { CornerRadiusF32 } from './corner_radius_f32.js';
import { RoundedRect } from './rounded_rect.js';
import { CubicBezierShape, QuadraticBezierShape } from './shapes/bezier_shape.js';
import { PathStroke } from './stroke.js';

const NO_STROKE = PathStroke.NONE;

function quadratic(points: [Pos2, Pos2, Pos2]): QuadraticBezierShape {
  return new QuadraticBezierShape(points, false, Color32.TRANSPARENT, NO_STROKE);
}

function cubic(points: [Pos2, Pos2, Pos2, Pos2]): CubicBezierShape {
  return new CubicBezierShape(points, false, Color32.TRANSPARENT, NO_STROKE);
}

/** Mirrors the Rust tests: start point, then every callback hit. */
function flattenCount(shape: QuadraticBezierShape | CubicBezierShape, tolerance: number): number {
  let n = 1;
  shape.for_each_flattened_with_t(tolerance, () => {
    n++;
  });
  return n;
}

// Straight from the `mod tests` in epaint/src/rounded_rect.rs.
describe('RoundedRect', () => {
  // Straight from `clamp_pos` in epaint/src/rounded_rect.rs.
  it('clamps positions onto the corner arcs', () => {
    const rect = Rect.from_min_max(pos2(0.0, 0.0), pos2(100.0, 100.0));
    const rounded = RoundedRect.new(rect, new CornerRadiusF32(10.0, 0.0, 0.0, 20.0));

    // Interior point is untouched:
    expect(rounded.clamp_pos(pos2(50.0, 50.0)).equals(pos2(50.0, 50.0))).toBe(true);

    // Sharp corner is untouched:
    expect(rounded.clamp_pos(pos2(100.0, 0.0)).equals(pos2(100.0, 0.0))).toBe(true);

    // Outside the rect is clamped to the edge:
    expect(rounded.clamp_pos(pos2(-10.0, 50.0)).equals(pos2(0.0, 50.0))).toBe(true);

    // Rounded corner is projected onto the arc:
    const clamped = rounded.clamp_pos(pos2(0.0, 0.0));
    const arc_center = pos2(10.0, 10.0);
    expect(clamped.sub(arc_center).length() - 10.0).toBeLessThan(0.001);
    const expected = 10.0 - 10.0 / Math.SQRT2;
    expect(clamped.sub(pos2(expected, expected)).length()).toBeLessThan(0.001);

    // Point on the arc stays put:
    expect(rounded.clamp_pos(pos2(10.0, 0.0)).equals(pos2(10.0, 0.0))).toBe(true);
  });

  // Straight from `expand` in epaint/src/rounded_rect.rs.
  it('expands', () => {
    const rect = Rect.from_min_max(pos2(10.0, 10.0), pos2(90.0, 90.0));
    const expanded = RoundedRect.new(rect, 20.0).expand(10.0);
    expect(expanded.rect().equals(Rect.from_min_max(pos2(0.0, 0.0), pos2(100.0, 100.0)))).toBe(true);
    expect(expanded.corner_radius().equals(CornerRadiusF32.same(30.0))).toBe(true);
  });

  // Straight from `oversized_radius_is_clamped` in epaint/src/rounded_rect.rs.
  it('clamps an oversized radius', () => {
    const rect = Rect.from_min_max(pos2(0.0, 0.0), pos2(100.0, 100.0));
    expect(RoundedRect.new(rect, 200.0).equals(RoundedRect.new(rect, 50.0))).toBe(true);
    expect(RoundedRect.new(rect, 200.0).corner_radius().equals(CornerRadiusF32.same(50.0))).toBe(true);
  });

  it('shrinks', () => {
    const rect = Rect.from_min_max(pos2(10.0, 10.0), pos2(90.0, 90.0));
    const shrunk = RoundedRect.new(rect, 20.0).shrink(10.0);
    expect(shrunk.rect().equals(Rect.from_min_max(pos2(20.0, 20.0), pos2(80.0, 80.0)))).toBe(true);
    expect(shrunk.corner_radius().equals(CornerRadiusF32.same(10.0))).toBe(true);
  });
});

// Straight from `test_quadratic_bounding_box` in
// epaint/src/shapes/bezier_shape.rs.
describe('QuadraticBezierShape', () => {
  it('computes its bounding box', () => {
    const curve = quadratic([new Pos2(110.0, 170.0), new Pos2(10.0, 10.0), new Pos2(180.0, 30.0)]);
    const bbox = curve.logical_bounding_rect();
    expect(Math.abs(bbox.min.x - 72.96)).toBeLessThan(0.01);
    expect(Math.abs(bbox.min.y - 27.78)).toBeLessThan(0.01);
    expect(Math.abs(bbox.max.x - 180.0)).toBeLessThan(0.01);
    expect(Math.abs(bbox.max.y - 170.0)).toBeLessThan(0.01);

    expect(flattenCount(curve, 0.1)).toBe(26);

    const curve2 = quadratic([new Pos2(110.0, 170.0), new Pos2(180.0, 30.0), new Pos2(10.0, 10.0)]);
    const bbox2 = curve2.logical_bounding_rect();
    expect(Math.abs(bbox2.min.x - 10.0)).toBeLessThan(0.01);
    expect(Math.abs(bbox2.min.y - 10.0)).toBeLessThan(0.01);
    expect(Math.abs(bbox2.max.x - 130.42)).toBeLessThan(0.01);
    expect(Math.abs(bbox2.max.y - 170.0)).toBeLessThan(0.01);

    expect(flattenCount(curve2, 0.1)).toBe(25);
  });

  // Straight from `test_quadratic_different_tolerance`.
  it('flattens at different tolerances', () => {
    const curve = quadratic([new Pos2(110.0, 170.0), new Pos2(180.0, 30.0), new Pos2(10.0, 10.0)]);
    expect(flattenCount(curve, 1.0)).toBe(9);
    expect(flattenCount(curve, 0.1)).toBe(25);
    expect(flattenCount(curve, 0.01)).toBe(77);
    expect(flattenCount(curve, 0.001)).toBe(240);
  });

  // Straight from `test_quadratic_flattening`.
  it('flattens a simple curve at different tolerances', () => {
    const curve = quadratic([pos2(0.0, 0.0), pos2(80.0, 200.0), pos2(100.0, 30.0)]);
    expect(flattenCount(curve, 1.0)).toBe(9);
    expect(flattenCount(curve, 0.5)).toBe(11);
    expect(flattenCount(curve, 0.1)).toBe(24);
    expect(flattenCount(curve, 0.01)).toBe(72);
    expect(flattenCount(curve, 0.001)).toBe(223);
  });

  it('samples the curve correctly', () => {
    const curve = quadratic([pos2(0, 0), pos2(50, 100), pos2(100, 0)]);
    expect(curve.sample(0).equals(pos2(0, 0))).toBe(true);
    expect(curve.sample(1).equals(pos2(100, 0))).toBe(true);
    expect(curve.sample(0.5).equals(pos2(50, 50))).toBe(true);
    expect(() => curve.sample(1.5)).toThrow(RangeError);
  });

  it('flattens a degenerate curve (a point)', () => {
    const p = quadratic([pos2(5, 5), pos2(5, 5), pos2(5, 5)]);
    expect(flattenCount(p, 0.1)).toBe(1);
  });

  it('converts to a path shape', () => {
    const curve = quadratic([pos2(0, 0), pos2(50, 100), pos2(100, 0)]);
    const path = curve.to_path_shape(0.1);
    expect(path.points.length).toBeGreaterThan(2);
    expect(path.points[0]!.equals(curve.points[0])).toBe(true);
  });
});

// Straight from `test_cubic_bounding_box` in
// epaint/src/shapes/bezier_shape.rs.
describe('CubicBezierShape', () => {
  it('computes its bounding box', () => {
    let curve = cubic([pos2(10.0, 10.0), pos2(110.0, 170.0), pos2(180.0, 30.0), pos2(270.0, 210.0)]);
    let bbox = curve.logical_bounding_rect();
    expect(bbox.min.x).toBe(10.0);
    expect(bbox.min.y).toBe(10.0);
    expect(bbox.max.x).toBe(270.0);
    expect(bbox.max.y).toBe(210.0);

    curve = cubic([pos2(10.0, 10.0), pos2(110.0, 170.0), pos2(270.0, 210.0), pos2(180.0, 30.0)]);
    bbox = curve.logical_bounding_rect();
    expect(bbox.min.x).toBe(10.0);
    expect(bbox.min.y).toBe(10.0);
    expect(Math.abs(bbox.max.x - 206.5)).toBeLessThan(0.01);
    expect(Math.abs(bbox.max.y - 148.48)).toBeLessThan(0.01);

    curve = cubic([pos2(110.0, 170.0), pos2(10.0, 10.0), pos2(270.0, 210.0), pos2(180.0, 30.0)]);
    bbox = curve.logical_bounding_rect();
    expect(Math.abs(bbox.min.x - 86.71)).toBeLessThan(0.01);
    expect(Math.abs(bbox.min.y - 30.0)).toBeLessThan(0.01);
    expect(Math.abs(bbox.max.x - 199.27)).toBeLessThan(0.01);
    expect(Math.abs(bbox.max.y - 170.0)).toBeLessThan(0.01);
  });

  // Straight from `test_cubic_different_tolerance_flattening`.
  it('flattens at different tolerances', () => {
    const curve = cubic([pos2(0.0, 0.0), pos2(100.0, 0.0), pos2(100.0, 100.0), pos2(100.0, 200.0)]);
    expect(flattenCount(curve, 1.0)).toBe(10);
    expect(flattenCount(curve, 0.5)).toBe(13);
    expect(flattenCount(curve, 0.1)).toBe(28);
    expect(flattenCount(curve, 0.01)).toBe(83);
    expect(flattenCount(curve, 0.001)).toBe(248);
  });

  // Straight from `test_cubic_different_shape_flattening`.
  it('flattens different shapes consistently', () => {
    expect(flattenCount(cubic([pos2(90.0, 110.0), pos2(30.0, 170.0), pos2(210.0, 170.0), pos2(170.0, 110.0)]), 0.01)).toBe(117);
    expect(flattenCount(cubic([pos2(90.0, 110.0), pos2(90.0, 170.0), pos2(170.0, 170.0), pos2(170.0, 110.0)]), 0.01)).toBe(91);
    expect(flattenCount(cubic([pos2(90.0, 110.0), pos2(110.0, 170.0), pos2(150.0, 170.0), pos2(170.0, 110.0)]), 0.01)).toBe(75);
    expect(flattenCount(cubic([pos2(90.0, 110.0), pos2(110.0, 170.0), pos2(230.0, 110.0), pos2(170.0, 110.0)]), 0.01)).toBe(100);
    expect(flattenCount(cubic([pos2(90.0, 110.0), pos2(110.0, 170.0), pos2(210.0, 70.0), pos2(170.0, 110.0)]), 0.01)).toBe(71);
    expect(flattenCount(cubic([pos2(90.0, 110.0), pos2(110.0, 170.0), pos2(150.0, 50.0), pos2(170.0, 110.0)]), 0.01)).toBe(88);
  });

  // Straight from `test_cubic_find_cross_t`.
  it('finds where the curve crosses its base line', () => {
    const cross_t = (points: [Pos2, Pos2, Pos2, Pos2]) =>
      new CubicBezierShape(points, true, Color32.RED, NO_STROKE).find_cross_t(1e-5);

    // Symmetric S-curve: crosses the base line exactly in the middle.
    expect(cross_t([pos2(0.0, 0.0), pos2(1.0, 1.0), pos2(2.0, -1.0), pos2(3.0, 0.0)])).toBe(0.5);

    // Asymmetric S-curve: c/a = y1 / (y1 - y2) = 1 / (1 + 3) = 0.25
    const t = cross_t([pos2(0.0, 0.0), pos2(1.0, 1.0), pos2(2.0, -3.0), pos2(3.0, 0.0)]);
    expect(t).toBeDefined();
    expect(Math.abs(t! - 0.25)).toBeLessThan(1e-6);

    // Convex arch: only touches the base line at the end points.
    expect(cross_t([pos2(0.0, 0.0), pos2(1.0, 1.0), pos2(2.0, 1.0), pos2(3.0, 0.0)])).toBeUndefined();

    // Straight line and fully degenerate curve (a == 0): no crossing.
    expect(cross_t([pos2(0.0, 0.0), pos2(1.0, 1.0), pos2(2.0, 2.0), pos2(3.0, 3.0)])).toBeUndefined();
    expect(cross_t([Pos2.ZERO, Pos2.ZERO, Pos2.ZERO, Pos2.ZERO])).toBeUndefined();
  });

  it('samples the curve correctly', () => {
    const curve = cubic([pos2(0, 0), pos2(0, 100), pos2(100, 100), pos2(100, 0)]);
    expect(curve.sample(0).equals(pos2(0, 0))).toBe(true);
    expect(curve.sample(1).equals(pos2(100, 0))).toBe(true);
    expect(curve.sample(0.5).equals(pos2(50, 75))).toBe(true);
  });

  it('splits a range off', () => {
    const curve = cubic([pos2(0, 0), pos2(0, 100), pos2(100, 100), pos2(100, 0)]);
    const half = curve.split_range(0.0, 0.5);
    expect(half.points[0].equals(curve.sample(0.0))).toBe(true);
    expect(half.points[3].equals(curve.sample(0.5))).toBe(true);
    // The split's own midpoint should sit on the original curve.
    const mid = half.sample(0.5);
    const origMid = curve.sample(0.25);
    expect(mid.x).toBeCloseTo(origMid.x, 4);
    expect(mid.y).toBeCloseTo(origMid.y, 4);
    expect(() => curve.split_range(0.5, 0.2)).toThrow(RangeError);
  });

  it('estimates the number of quadratics', () => {
    const curve = cubic([pos2(0, 0), pos2(0, 100), pos2(100, 100), pos2(100, 0)]);
    const n = curve.num_quadratics(0.1);
    expect(Number.isInteger(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(() => curve.num_quadratics(0)).toThrow(RangeError);
  });

  it('splits a closed crossing curve into two areas', () => {
    const curve = new CubicBezierShape(
      [pos2(0.0, 0.0), pos2(1.0, 1.0), pos2(2.0, -1.0), pos2(3.0, 0.0)],
      true,
      Color32.RED,
      NO_STROKE,
    );
    const areas = curve.flatten_closed(0.1, 1e-5);
    expect(areas.length).toBe(2);
  });

  it('produces one area for a convex closed curve', () => {
    const curve = new CubicBezierShape(
      [pos2(0.0, 0.0), pos2(1.0, 1.0), pos2(2.0, 1.0), pos2(3.0, 0.0)],
      true,
      Color32.RED,
      NO_STROKE,
    );
    const areas = curve.flatten_closed(0.1, 1e-5);
    expect(areas.length).toBe(1);
  });
});

describe('Bezier Shape integration', () => {
  it('bounds a stroked cubic curve with half the stroke width', () => {
    const curve = new CubicBezierShape(
      [pos2(0, 0), pos2(0, 50), pos2(100, 50), pos2(100, 0)],
      false,
      Color32.RED,
      PathStroke.new(2.0, Color32.RED),
    );
    const logical = curve.logical_bounding_rect();
    const visual = curve.visual_bounding_rect();
    expect(visual.min.x).toBeCloseTo(logical.min.x - 1, 6);
    expect(visual.max.y).toBeCloseTo(logical.max.y + 1, 6);
  });

  it('is NOTHING when invisible', () => {
    const curve = new CubicBezierShape(
      [pos2(0, 0), pos2(0, 50), pos2(100, 50), pos2(100, 0)],
      false,
      Color32.TRANSPARENT,
      NO_STROKE,
    );
    expect(curve.visual_bounding_rect().equals(Rect.NOTHING)).toBe(true);
  });

  it('transforms with a RectTransform', () => {
    const curve = cubic([pos2(0, 0), pos2(0, 50), pos2(100, 50), pos2(100, 0)]);
    // Map [0,100] -> [0,200], so x doubles and y is unchanged.
    const t = RectTransform.from_to(
      Rect.from_min_max(pos2(0, 0), pos2(100, 100)),
      Rect.from_min_max(pos2(0, 0), pos2(200, 100)),
    );
    const moved = curve.transform(t);
    expect(moved.points[2]!.x).toBeCloseTo(200, 4);
    expect(moved.points[2]!.y).toBeCloseTo(50, 4);
    // The original is untouched, since Rust's `transform(&self)` returns a new shape.
    expect(curve.points[2]!.x).toBe(100);
  });
});