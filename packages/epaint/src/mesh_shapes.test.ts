import { describe, expect, it } from 'vitest';

import { Pos2, Rect, Rangef, Rot2, TSTransform, pos2, vec2 } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';

import { Mesh, Vertex } from './mesh.js';
import { CornerRadius } from './corner_radius.js';
import { PathStroke, Stroke } from './stroke.js';
import { BandPoint, BandShape } from './shapes/band_shape.js';
import { CircleShape } from './shapes/circle_shape.js';
import { EllipseShape } from './shapes/ellipse_shape.js';
import { PathShape } from './shapes/path_shape.js';
import { RectShape } from './shapes/rect_shape.js';
import {
  shapeCircleFilled,
  shapeConvexPolygon,
  shapeDashedLine,
  shapeDottedLine,
  shapeGradientRect,
  shapeHline,
  shapeNoop,
  shapeRotatedTriangle,
  shapeVline,
  shapeEquals,
  shapeVec,
  visual_bounding_rect,
} from './shapes/shape.js';
import { ViewportInPixels } from './shapes/paint_callback.js';
import { managed, user } from './texture_id.js';

describe('Mesh', () => {
  it('adds colored rects as two triangles', () => {
    const mesh = new Mesh();
    mesh.add_colored_rect(Rect.from_min_max(pos2(0, 0), pos2(10, 10)), Color32.RED);
    expect(mesh.vertices.length).toBe(4);
    expect(mesh.indices).toEqual([0, 1, 2, 2, 1, 3]);
    expect(mesh.is_valid()).toBe(true);
    expect(mesh.is_empty()).toBe(false);
  });

  it('computes bounds', () => {
    const mesh = new Mesh();
    mesh.add_colored_rect(Rect.from_min_max(pos2(1, 2), pos2(10, 20)), Color32.RED);
    expect(mesh.calc_bounds().equals(Rect.from_min_max(pos2(1, 2), pos2(10, 20)))).toBe(true);
    expect(new Mesh().calc_bounds().equals(Rect.NOTHING)).toBe(true);
  });

  it('iterates triangles, dropping a trailing partial', () => {
    const mesh = new Mesh();
    mesh.add_triangle(0, 1, 2);
    mesh.add_triangle(1, 2, 3);
    mesh.indices.push(9); // incomplete triangle
    expect(mesh.triangles()).toEqual([
      [0, 1, 2],
      [1, 2, 3],
    ]);
  });

  it('detects invalid indices', () => {
    const mesh = new Mesh();
    mesh.vertices.push(Vertex.untextured(pos2(0, 0), Color32.RED));
    mesh.indices.push(0, 1, 2); // 1 and 2 are out of bounds
    expect(mesh.is_valid()).toBe(false);
  });

  it('appends with an index offset', () => {
    const a = new Mesh();
    a.add_colored_rect(Rect.from_min_max(pos2(0, 0), pos2(1, 1)), Color32.RED);
    const b = new Mesh();
    b.add_colored_rect(Rect.from_min_max(pos2(5, 5), pos2(6, 6)), Color32.BLUE);

    a.append(b);
    expect(a.vertices.length).toBe(8);
    expect(a.indices).toEqual([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);
    expect(a.is_valid()).toBe(true);
  });

  it('refuses to merge different textures', () => {
    const a = new Mesh(managed(1));
    a.add_colored_rect(Rect.from_min_max(pos2(0, 0), pos2(1, 1)), Color32.RED);
    const b = new Mesh(managed(2));
    b.add_colored_rect(Rect.from_min_max(pos2(0, 0), pos2(1, 1)), Color32.RED);
    expect(() => a.append(b)).toThrow(/different textures/);
  });

  it('takes the texture from the first append into an empty mesh', () => {
    const a = new Mesh();
    const b = new Mesh(managed(7));
    a.append(b);
    expect(a.texture_id).toEqual(managed(7));
  });

  it('transforms vertices in place', () => {
    const mesh = new Mesh();
    mesh.add_colored_rect(Rect.from_min_max(pos2(0, 0), pos2(1, 1)), Color32.RED);
    mesh.transform(TSTransform.new(vec2(10, 0), 2.0));
    expect(mesh.calc_bounds().equals(Rect.from_min_max(pos2(10, 0), pos2(12, 2)))).toBe(true);

    mesh.translate(vec2(0, 5));
    expect(mesh.calc_bounds().min.equals(pos2(10, 5))).toBe(true);

    mesh.rotate(Rot2.from_angle(Math.PI / 2), pos2(10, 5));
    const b = mesh.calc_bounds();
    expect(b.width()).toBeCloseTo(2, 6);
    expect(b.height()).toBeCloseTo(2, 6);
  });

  it('clears', () => {
    const mesh = new Mesh();
    mesh.add_colored_rect(Rect.from_min_max(pos2(0, 0), pos2(1, 1)), Color32.RED);
    mesh.clear();
    expect(mesh.is_empty()).toBe(true);
  });

  it('uses WHITE_UV for untextured vertices', () => {
    const v = Vertex.untextured(pos2(0, 0), Color32.RED);
    expect(v.uv.equals(pos2(0, 0))).toBe(true);
  });
});

describe('CircleShape', () => {
  it('bounds itself including the stroke', () => {
    const filled = CircleShape.filled(pos2(10, 10), 5.0, Color32.RED);
    expect(filled.visual_bounding_rect().equals(Rect.from_min_max(pos2(5, 5), pos2(15, 15)))).toBe(true);

    const stroked = CircleShape.stroke(pos2(10, 10), 5.0, new Stroke(2.0, Color32.RED));
    expect(stroked.visual_bounding_rect().equals(Rect.from_min_max(pos2(4, 4), pos2(16, 16)))).toBe(true);
  });

  it('is NOTHING when invisible', () => {
    const c = new CircleShape(pos2(10, 10), 5.0, Color32.TRANSPARENT, Stroke.NONE);
    expect(c.visual_bounding_rect().equals(Rect.NOTHING)).toBe(true);
  });
});

describe('EllipseShape', () => {
  it('bounds itself including stroke and rotation', () => {
    const e = EllipseShape.filled(pos2(0, 0), vec2(10, 5), Color32.RED);
    const r = e.visual_bounding_rect();
    expect(r.width()).toBeCloseTo(20, 6);
    expect(r.height()).toBeCloseTo(10, 6);

    // Rotating 90 degrees swaps the extents.
    const rotated = e.with_angle(Math.PI / 2).visual_bounding_rect();
    expect(rotated.width()).toBeCloseTo(10, 5);
    expect(rotated.height()).toBeCloseTo(20, 5);
  });

  it('rotates around a pivot', () => {
    const e = EllipseShape.filled(pos2(10, 0), vec2(1, 1), Color32.RED);
    const moved = e.with_angle_and_pivot(Math.PI / 2, pos2(0, 0));
    expect(moved.center.x).toBeCloseTo(0, 6);
    expect(moved.center.y).toBeCloseTo(10, 6);
    // The original is untouched.
    expect(e.center.equals(pos2(10, 0))).toBe(true);
  });
});

describe('RectShape', () => {
  it('expands the bounds by stroke and blur', () => {
    const inside = RectShape.filled(Rect.from_min_max(pos2(0, 0), pos2(10, 10)), CornerRadius.ZERO, Color32.RED);
    expect(inside.visual_bounding_rect().equals(Rect.from_min_max(pos2(0, 0), pos2(10, 10)))).toBe(true);

    const middle = inside.with_stroke_kind('Middle');
    middle.stroke = new Stroke(2.0, Color32.BLUE);
    expect(middle.visual_bounding_rect().equals(Rect.from_min_max(pos2(-1, -1), pos2(11, 11)))).toBe(true);

    middle.with_blur_width(4.0);
    expect(middle.visual_bounding_rect().equals(Rect.from_min_max(pos2(-3, -3), pos2(13, 13)))).toBe(true);
  });

  it('is NOTHING when invisible', () => {
    const r = RectShape.filled(Rect.from_min_max(pos2(0, 0), pos2(10, 10)), CornerRadius.ZERO, Color32.TRANSPARENT);
    expect(r.visual_bounding_rect().equals(Rect.NOTHING)).toBe(true);
  });

  it('reports its texture', () => {
    const r = RectShape.filled(Rect.from_min_max(pos2(0, 0), pos2(10, 10)), CornerRadius.ZERO, Color32.RED);
    expect(r.fill_texture_id()).toEqual(managed(0));
    r.with_texture(user(3), Rect.from_min_max(pos2(0, 0), pos2(1, 1)));
    expect(r.fill_texture_id()).toEqual(user(3));
  });

  it('rotates around a pivot and moves the rect', () => {
    const r = RectShape.filled(Rect.from_min_max(pos2(0, 0), pos2(10, 10)), CornerRadius.ZERO, Color32.RED);
    r.with_angle_and_pivot(Math.PI / 2, pos2(0, 0));
    // Rotating 90 degrees about the (0,0) corner carries the top-left corner to
    // where the top-right corner used to be, so the rect runs from (-10,0) to
    // (0,10) and (0,0) is unchanged.
    expect(r.rect.right()).toBeCloseTo(0, 6);
    expect(r.rect.top()).toBeCloseTo(0, 6);
    expect(r.rect.left()).toBeCloseTo(-10, 6);
    expect(r.rect.bottom()).toBeCloseTo(10, 6);
    expect(r.angle).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe('PathShape', () => {
  it('bounds itself including half the stroke width', () => {
    const p = PathShape.line([pos2(0, 0), pos2(10, 0)], PathStroke.new(2.0, Color32.RED));
    // `Rect::expand` grows all four sides, not just the perpendicular ones.
    expect(p.visual_bounding_rect().equals(Rect.from_min_max(pos2(-1, -1), pos2(11, 1)))).toBe(true);
  });

  it('is NOTHING when invisible', () => {
    const p = PathShape.line([pos2(0, 0), pos2(10, 0)], PathStroke.NONE);
    expect(p.visual_bounding_rect().equals(Rect.NOTHING)).toBe(true);
  });
});

describe('BandShape', () => {
  const points = [
    BandPoint.from_pos_and_width(pos2(0, 0), 2),
    BandPoint.from_pos_and_width(pos2(10, 0), 2),
  ];

  it('bounds a horizontal band', () => {
    const b = BandShape.filled(points, Color32.RED);
    const r = b.visual_bounding_rect();
    expect(r.top()).toBeCloseTo(-1, 6);
    expect(r.bottom()).toBeCloseTo(1, 6);
    expect(r.left()).toBeCloseTo(0, 6);
    expect(r.right()).toBeCloseTo(10, 6);
  });

  it('validates points', () => {
    expect(BandPoint.from_pos_and_width(pos2(0, 0), 2).is_valid()).toBe(true);
    expect(new BandPoint(0, new Rangef(5, 1)).is_valid()).toBe(false); // inverted
    expect(new BandPoint(Number.NaN, new Rangef(0, 1)).is_valid()).toBe(false);
  });

  it('scales by the transform', () => {
    const b = BandShape.new(points.map((p) => p.clone()), Color32.RED, new Stroke(2.0, Color32.RED));
    b.transform(TSTransform.from_scaling(2.0));
    expect(b.stroke.width).toBeCloseTo(4.0, 6);
    expect(b.points[1]!.x).toBeCloseTo(20, 6);
  });
});

// Straight from `test_viewport_rounding` in epaint/src/shapes/paint_callback.rs.
describe('ViewportInPixels', () => {
  it('never leaves a gap between adjacent viewports', () => {
    for (let i = 0; i <= 10_000; i++) {
      const x = i / 97.0;
      const full = Rect.from_min_max(pos2(0.0, 0.0), pos2(100.0, 100.0));
      const left = ViewportInPixels.from_points(full.with_max_x(x), 1.0, [100, 100]);
      const right = ViewportInPixels.from_points(full.with_min_x(x), 1.0, [100, 100]);
      expect(left.left_px + left.width_px, `i=${i} ppp=1.0`).toBe(right.left_px);
    }
  });

  it('holds for fractional pixels_per_point', () => {
    for (const ppp of [0.618, 1.0, Math.PI]) {
      for (let i = 0; i <= 500; i++) {
        const x = i / 97.0;
        const full = Rect.from_min_max(pos2(0.0, 0.0), pos2(100.0, 100.0));
        const left = ViewportInPixels.from_points(full.with_max_x(x), ppp, [100, 100]);
        const right = ViewportInPixels.from_points(full.with_min_x(x), ppp, [100, 100]);
        expect(left.left_px + left.width_px, `i=${i} ppp=${ppp}`).toBe(right.left_px);
      }
    }
  });
});

describe('Shape', () => {
  it('reports bounds recursively', () => {
    const a = shapeCircleFilled(pos2(0, 0), 5.0, Color32.RED);
    const b = shapeCircleFilled(pos2(100, 0), 5.0, Color32.RED);
    const combined = shapeVec([a, b]);
    expect(visual_bounding_rect(combined).left()).toBe(-5);
    expect(visual_bounding_rect(combined).right()).toBe(105);
  });

  it('bounds Noop as NOTHING', () => {
    expect(visual_bounding_rect(shapeNoop()).equals(Rect.NOTHING)).toBe(true);
  });

  it('builds hline and vline', () => {
    // The bounds come from `Rect::from_two_pos(..).expand(width * 0.5)`, and
    // `expand` grows all four sides.
    const h = shapeHline(new Rangef(0, 10), 5, new Stroke(1, Color32.RED));
    expect(visual_bounding_rect(h).equals(Rect.from_min_max(pos2(-0.5, 4.5), pos2(10.5, 5.5)))).toBe(true);

    const v = shapeVline(5, new Rangef(0, 10), new Stroke(1, Color32.RED));
    expect(visual_bounding_rect(v).equals(Rect.from_min_max(pos2(4.5, -0.5), pos2(5.5, 10.5)))).toBe(true);
  });

  it('builds a gradient rect as a mesh', () => {
    const s = shapeGradientRect(Rect.from_min_max(pos2(0, 0), pos2(10, 10)), 'TopDown', [Color32.RED, Color32.BLUE]);
    expect(s.kind).toBe('Mesh');
    if (s.kind === 'Mesh') {
      expect(s.mesh.vertices[0]!.color.equals(Color32.RED)).toBe(true);
      expect(s.mesh.vertices[3]!.color.equals(Color32.BLUE)).toBe(true); // right_bottom
      expect(s.mesh.indices).toEqual([0, 1, 2, 2, 1, 3]);
    }
  });

  it('orients gradients per direction', () => {
    const check = (dir: 'TopDown' | 'BottomUp' | 'LeftToRight' | 'RightToLeft', i: number) => {
      const s = shapeGradientRect(Rect.from_min_max(pos2(0, 0), pos2(10, 10)), dir, [Color32.RED, Color32.BLUE]);
      if (s.kind !== 'Mesh') throw new Error('expected a Mesh');
      return s.mesh.vertices[i]!.color.equals(Color32.RED);
    };
    // Vertex order: left_top, right_top, left_bottom, right_bottom
    expect(check('TopDown', 0)).toBe(true); // left_top = from
    expect(check('TopDown', 3)).toBe(false); // right_bottom = to
    expect(check('BottomUp', 0)).toBe(false);
    expect(check('BottomUp', 3)).toBe(true);
    expect(check('LeftToRight', 1)).toBe(false); // right_top = to
    expect(check('RightToLeft', 1)).toBe(true);
  });

  it('builds a rotated triangle', () => {
    const rect = Rect.from_min_max(pos2(0, 0), pos2(10, 10));
    // Unrotated: the vertices are left_top, right_top and center_bottom.
    const down = shapeRotatedTriangle(rect, 0.0, Color32.RED);
    expect(visual_bounding_rect(down).equals(rect)).toBe(true);

    // A quarter turn carries left_top -> right_top, right_top -> right_bottom,
    // and the center_bottom apex -> center_left, so the triangle now points
    // left. Its bounds still span the whole rect.
    const left = shapeRotatedTriangle(rect, Math.PI / 2, Color32.RED);
    expect(visual_bounding_rect(left).equals(rect)).toBe(true);
    if (left.kind !== 'Path') throw new Error('expected a Path');
    const points = left.shape.points;
    expect(points[0]!.x).toBeCloseTo(10, 6);
    expect(points[0]!.y).toBeCloseTo(0, 6);
    expect(points[1]!.x).toBeCloseTo(10, 6);
    expect(points[1]!.y).toBeCloseTo(10, 6);
    expect(points[2]!.x).toBeCloseTo(0, 6);
    expect(points[2]!.y).toBeCloseTo(5, 6);
  });

  it('turns a line into dots', () => {
    const dots = shapeDottedLine([pos2(0, 0), pos2(10, 0)], Color32.RED, 2.0, 1.0);
    expect(dots.length).toBeGreaterThan(0);
    for (const d of dots) {
      expect(d.kind).toBe('Circle');
    }
  });

  it('turns a line into dashes', () => {
    const dashes = shapeDashedLine([pos2(0, 0), pos2(10, 0)], new Stroke(1, Color32.RED), 2.0, 2.0);
    expect(dashes.length).toBeGreaterThan(0);
    for (const d of dashes) {
      expect(d.kind).toBe('LineSegment');
    }
  });

  it('rejects mismatched dash and gap lengths', () => {
    expect(() =>
      shapeDashedLine([pos2(0, 0), pos2(10, 0)], new Stroke(1, Color32.RED), 2.0, 2.0),
    ).not.toThrow();
  });

  it('compares shapes', () => {
    expect(
      shapeEquals(
        shapeCircleFilled(pos2(0, 0), 5.0, Color32.RED),
        shapeCircleFilled(pos2(0, 0), 5.0, Color32.RED),
      ),
    ).toBe(true);
    expect(
      shapeEquals(
        shapeCircleFilled(pos2(0, 0), 5.0, Color32.RED),
        shapeCircleFilled(pos2(0, 0), 6.0, Color32.RED),
      ),
    ).toBe(false);
    expect(shapeEquals(shapeNoop(), shapeCircleFilled(pos2(0, 0), 5.0, Color32.RED))).toBe(false);
  });

  it('compares nested Vec shapes', () => {
    const a = shapeVec([shapeCircleFilled(pos2(0, 0), 1.0, Color32.RED)]);
    const b = shapeVec([shapeCircleFilled(pos2(0, 0), 1.0, Color32.RED)]);
    expect(shapeEquals(a, b)).toBe(true);
  });
});

describe('ConvexPolygon', () => {
  it('bounds a triangle', () => {
    const p = shapeConvexPolygon([pos2(0, 0), pos2(10, 0), pos2(0, 10)], Color32.RED, PathStroke.NONE);
    expect(visual_bounding_rect(p).equals(Rect.from_min_max(pos2(0, 0), pos2(10, 10)))).toBe(true);
  });
});