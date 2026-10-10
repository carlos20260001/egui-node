import { describe, expect, it } from 'vitest';

import { pos2 } from './pos2.js';
import { Rangef } from './range.js';
import { Rect } from './rect.js';
import { vec2, Vec2 } from './vec2.js';

describe('Rect', () => {
  // Straight from `test_rect` in emath/src/rect.rs.
  it('measures distance to a position', () => {
    const r = Rect.from_min_max(pos2(10.0, 10.0), pos2(20.0, 20.0));
    expect(r.distance_sq_to_pos(pos2(15.0, 15.0))).toBe(0.0);
    expect(r.distance_sq_to_pos(pos2(10.0, 15.0))).toBe(0.0);
    expect(r.distance_sq_to_pos(pos2(10.0, 10.0))).toBe(0.0);

    expect(r.distance_sq_to_pos(pos2(5.0, 15.0))).toBe(25.0); // left of
    expect(r.distance_sq_to_pos(pos2(25.0, 15.0))).toBe(25.0); // right of
    expect(r.distance_sq_to_pos(pos2(15.0, 5.0))).toBe(25.0); // above
    expect(r.distance_sq_to_pos(pos2(15.0, 25.0))).toBe(25.0); // below
    expect(r.distance_sq_to_pos(pos2(25.0, 5.0))).toBe(50.0); // right and above
  });

  // Straight from `scale_rect` in emath/src/rect.rs.
  it('scales from the center', () => {
    const c = pos2(100.0, 50.0);
    const r = Rect.from_center_size(c, vec2(30.0, 60.0));

    expect(r.scale_from_center(2.0).equals(Rect.from_center_size(c, vec2(60.0, 120.0)))).toBe(true);
    expect(r.scale_from_center(0.5).equals(Rect.from_center_size(c, vec2(15.0, 30.0)))).toBe(true);
    expect(r.scale_from_center2(vec2(2.0, 3.0)).equals(Rect.from_center_size(c, vec2(60.0, 180.0)))).toBe(true);
  });

  // Straight from `test_ray_intersection` in emath/src/rect.rs.
  it('detects ray intersections', () => {
    const rect = Rect.from_min_max(pos2(1.0, 1.0), pos2(3.0, 3.0));

    expect(rect.intersects_ray(pos2(0.0, 2.0), Vec2.RIGHT)).toBe(true); // from left
    expect(rect.intersects_ray(pos2(2.0, 2.0), Vec2.RIGHT)).toBe(true); // from center
    expect(rect.intersects_ray(pos2(4.0, 2.0), Vec2.RIGHT)).toBe(false); // from right

    expect(rect.intersects_ray(pos2(0.0, 2.0), Vec2.LEFT)).toBe(false); // from left
    expect(rect.intersects_ray(pos2(2.0, 2.0), Vec2.LEFT)).toBe(true); // from center
    expect(rect.intersects_ray(pos2(4.0, 2.0), Vec2.LEFT)).toBe(true); // from right
  });

  // Straight from `test_ray_from_center_intersection` in emath/src/rect.rs.
  it('finds where a ray from the center exits', () => {
    const rect = Rect.from_min_max(pos2(1.0, 1.0), pos2(3.0, 3.0));

    expect(rect.intersects_ray_from_center(Vec2.RIGHT).equals(pos2(3.0, 2.0))).toBe(true); // rightward
    expect(rect.intersects_ray_from_center(Vec2.UP).equals(pos2(2.0, 1.0))).toBe(true); // upward
    expect(rect.intersects_ray_from_center(Vec2.LEFT).equals(pos2(1.0, 2.0))).toBe(true); // leftward
    expect(rect.intersects_ray_from_center(Vec2.DOWN).equals(pos2(2.0, 3.0))).toBe(true); // downward

    expect(
      rect.intersects_ray_from_center(Vec2.LEFT.add(Vec2.DOWN).normalized()).equals(pos2(1.0, 3.0)),
    ).toBe(true); // bottom-left corner

    expect(
      rect.intersects_ray_from_center(Vec2.LEFT.add(Vec2.UP).normalized()).equals(pos2(1.0, 1.0)),
    ).toBe(true); // top-left corner

    expect(
      rect.intersects_ray_from_center(Vec2.RIGHT.add(Vec2.DOWN).normalized()).equals(pos2(3.0, 3.0)),
    ).toBe(true); // bottom-right corner

    expect(
      rect.intersects_ray_from_center(Vec2.RIGHT.add(Vec2.UP).normalized()).equals(pos2(3.0, 1.0)),
    ).toBe(true); // top-right corner
  });

  // From the doc-test on `Rect::NOTHING` in emath/src/rect.rs.
  it('grows from NOTHING into a bounding box', () => {
    const rect = Rect.NOTHING.clone();
    expect(rect.size().equals(vec2(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY))).toBe(true);
    expect(rect.contains(pos2(0.0, 0.0))).toBe(false);
    rect.extend_with(pos2(2.0, 1.0));
    rect.extend_with(pos2(0.0, 3.0));
    expect(rect.equals(Rect.from_min_max(pos2(0.0, 1.0), pos2(2.0, 3.0)))).toBe(true);
  });

  // From the doc-test on `signed_distance_to_pos` in emath/src/rect.rs.
  it('computes signed distance to the edge', () => {
    const rect = Rect.from_min_max(pos2(0.0, 0.0), pos2(1.0, 1.0));
    expect(rect.signed_distance_to_pos(pos2(0.5, 0.5))).toBe(-0.5);
    expect(rect.signed_distance_to_pos(pos2(0.75, 0.5))).toBe(-0.25);
    expect(rect.signed_distance_to_pos(pos2(1.5, 0.5))).toBe(0.5);
  });

  it('has the expected constants and edge accessors', () => {
    const r = Rect.from_min_max(pos2(1, 2), pos2(5, 8));
    expect(r.left()).toBe(1);
    expect(r.top()).toBe(2);
    expect(r.right()).toBe(5);
    expect(r.bottom()).toBe(8);
    expect(r.width()).toBe(4);
    expect(r.height()).toBe(6);
    expect(r.center().equals(pos2(3, 5))).toBe(true);
    expect(r.area()).toBe(24);
    expect(r.aspect_ratio()).toBe(4 / 6);
  });

  it('splits into halves', () => {
    const r = Rect.from_min_max(pos2(0, 0), pos2(10, 20));
    const [left, right] = r.split_left_right_at_x(4);
    expect(left.equals(Rect.from_min_max(pos2(0, 0), pos2(4, 20)))).toBe(true);
    expect(right.equals(Rect.from_min_max(pos2(4, 0), pos2(10, 20)))).toBe(true);

    const [top, bottom] = r.split_top_bottom_at_y(5);
    expect(top.equals(Rect.from_min_max(pos2(0, 0), pos2(10, 5)))).toBe(true);
    expect(bottom.equals(Rect.from_min_max(pos2(0, 5), pos2(10, 20)))).toBe(true);
  });

  it('unions, intersects and expands', () => {
    const a = Rect.from_min_max(pos2(0, 0), pos2(10, 10));
    const b = Rect.from_min_max(pos2(5, 5), pos2(20, 20));

    expect(a.union(b).equals(Rect.from_min_max(pos2(0, 0), pos2(20, 20)))).toBe(true);
    expect(a.intersect(b).equals(Rect.from_min_max(pos2(5, 5), pos2(10, 10)))).toBe(true);
    expect(a.intersects(b)).toBe(true);
    expect(a.expand(1).equals(Rect.from_min_max(pos2(-1, -1), pos2(11, 11)))).toBe(true);
    expect(a.shrink(1).equals(Rect.from_min_max(pos2(1, 1), pos2(9, 9)))).toBe(true);
  });

  it('reports negative and positive sizes', () => {
    const flipped = Rect.from_min_max(pos2(10, 10), pos2(0, 0));
    expect(flipped.is_negative()).toBe(true);
    expect(flipped.is_positive()).toBe(false);
    expect(flipped.area()).toBe(0); // area clamps at zero
    expect(flipped.distance_sq_to_pos(pos2(5, 5))).toBe(Number.POSITIVE_INFINITY);

    const good = Rect.from_min_max(pos2(0, 0), pos2(10, 10));
    expect(good.is_negative()).toBe(false);
    expect(good.is_positive()).toBe(true);
  });

  it('formats like Rust Display and Debug', () => {
    const r = Rect.from_min_max(pos2(1, 2), pos2(3, 4));
    expect(r.toString()).toBe('[[1 2] - [3 4]]');
    expect(r.toDebug()).toBe('[[1.0 2.0] - [3.0 4.0]]');
  });
});

describe('Rangef', () => {
  // From the doc-tests in emath/src/range.rs.
  it('computes intersections', () => {
    expect(new Rangef(0.0, 10.0).intersection(new Rangef(5.0, 15.0)).equals(new Rangef(5.0, 10.0))).toBe(true);
    expect(new Rangef(0.0, 10.0).intersection(new Rangef(10.0, 20.0)).equals(new Rangef(10.0, 10.0))).toBe(true);
    expect(new Rangef(0.0, 10.0).intersection(new Rangef(20.0, 30.0)).span()).toBeLessThan(0.0);
  });

  it('computes unions', () => {
    expect(new Rangef(0.0, 10.0).union(new Rangef(5.0, 15.0)).equals(new Rangef(0.0, 15.0))).toBe(true);
    expect(new Rangef(0.0, 10.0).union(new Rangef(20.0, 30.0)).equals(new Rangef(0.0, 30.0))).toBe(true);
    expect(Rangef.NOTHING.union(Rangef.point(3.0)).equals(Rangef.point(3.0))).toBe(true);
  });

  it('detects intersections', () => {
    expect(new Rangef(0.0, 10.0).intersects(new Rangef(5.0, 15.0))).toBe(true);
    expect(new Rangef(0.0, 10.0).intersects(new Rangef(5.0, 6.0))).toBe(true);
    expect(new Rangef(0.0, 10.0).intersects(new Rangef(10.0, 20.0))).toBe(true);
    expect(new Rangef(0.0, 10.0).intersects(new Rangef(20.0, 30.0))).toBe(false);
  });

  it('has the expected basics', () => {
    expect(new Rangef(0, 10).span()).toBe(10);
    expect(new Rangef(0, 10).center()).toBe(5);
    expect(new Rangef(0, 10).contains(5)).toBe(true);
    expect(new Rangef(0, 10).clamp(15)).toBe(10);
    expect(new Rangef(0, 10).flipped().equals(new Rangef(10, 0))).toBe(true);
    expect(new Rangef(10, 0).as_positive().equals(new Rangef(0, 10))).toBe(true);
  });
});