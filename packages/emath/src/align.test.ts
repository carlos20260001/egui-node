import { describe, expect, it } from 'vitest';

import { align_flipped, align_size_within_range, align_to_factor, align_to_sign, Align2, center_size_in_rect } from './align.js';
import { pos2 } from './pos2.js';
import { Rangef } from './range.js';
import { Rect } from './rect.js';
import { RectAlign } from './rect_align.js';
import { RectTransform } from './rect_transform.js';
import { Rot2 } from './rot2.js';
import { TSTransform } from './ts_transform.js';
import { vec2, Vec2 } from './vec2.js';

const INF = Number.POSITIVE_INFINITY;
const NEG_INF = Number.NEGATIVE_INFINITY;

function rf(min: number, max: number): Rangef {
  return new Rangef(min, max);
}

describe('Align', () => {
  it('converts to factors and signs', () => {
    expect(align_to_factor('Min')).toBe(0.0);
    expect(align_to_factor('Center')).toBe(0.5);
    expect(align_to_factor('Max')).toBe(1.0);
    expect(align_to_sign('Min')).toBe(-1.0);
    expect(align_to_sign('Center')).toBe(0.0);
    expect(align_to_sign('Max')).toBe(1.0);
  });

  it('flips', () => {
    expect(align_flipped('Min')).toBe('Max');
    expect(align_flipped('Center')).toBe('Center');
    expect(align_flipped('Max')).toBe('Min');
  });

  // All of these come from the doc-test on `align_size_within_range` in
  // emath/src/align.rs.
  it('aligns a size within a range when the size is smaller', () => {
    expect(align_size_within_range('Min', 2.0, rf(10.0, 20.0)).equals(rf(10.0, 12.0))).toBe(true);
    expect(align_size_within_range('Center', 2.0, rf(10.0, 20.0)).equals(rf(14.0, 16.0))).toBe(true);
    expect(align_size_within_range('Max', 2.0, rf(10.0, 20.0)).equals(rf(18.0, 20.0))).toBe(true);
  });

  it('aligns a size within a range when the size is bigger', () => {
    expect(align_size_within_range('Min', 20.0, rf(10.0, 20.0)).equals(rf(10.0, 30.0))).toBe(true);
    expect(align_size_within_range('Center', 20.0, rf(10.0, 20.0)).equals(rf(5.0, 25.0))).toBe(true);
    expect(align_size_within_range('Max', 20.0, rf(10.0, 20.0)).equals(rf(0.0, 20.0))).toBe(true);
  });

  it('aligns an infinite size within a finite range', () => {
    expect(align_size_within_range('Min', INF, rf(10.0, 20.0)).equals(rf(10.0, INF))).toBe(true);
    expect(align_size_within_range('Center', INF, rf(10.0, 20.0)).equals(rf(NEG_INF, INF))).toBe(true);
    expect(align_size_within_range('Max', INF, rf(10.0, 20.0)).equals(rf(NEG_INF, 20.0))).toBe(true);
  });

  it('reproduces the surprising empty-range cases', () => {
    // Allocating a size aligned for an infinity bound will lead to empty ranges!
    expect(align_size_within_range('Min', 2.0, rf(10.0, INF)).equals(rf(10.0, 12.0))).toBe(true);
    expect(align_size_within_range('Center', 2.0, rf(10.0, INF)).equals(rf(INF, INF))).toBe(true);
    expect(align_size_within_range('Max', 2.0, rf(10.0, INF)).equals(rf(INF, INF))).toBe(true);

    expect(align_size_within_range('Min', 2.0, rf(NEG_INF, 20.0)).equals(rf(NEG_INF, NEG_INF))).toBe(true);
    expect(align_size_within_range('Center', 2.0, rf(NEG_INF, 20.0)).equals(rf(NEG_INF, NEG_INF))).toBe(true);
    expect(align_size_within_range('Max', 2.0, rf(NEG_INF, 20.0)).equals(rf(18.0, 20.0))).toBe(true);

    // The infinity size always returns the given range if it has at least one
    // infinity bound.
    for (const align of ['Min', 'Center', 'Max'] as const) {
      expect(align_size_within_range(align, INF, rf(10.0, INF)).equals(rf(10.0, INF))).toBe(true);
      expect(align_size_within_range(align, INF, rf(NEG_INF, 20.0)).equals(rf(NEG_INF, 20.0))).toBe(true);
    }
  });
});

describe('Align2', () => {
  // Regression guard: Rust's `Align2` is `Copy`, so `with_x` cannot mutate the
  // receiver. If it did, `RectAlign.flipped_x()` would corrupt the shared
  // `Align2.LEFT_TOP` constant and this test would fail.
  it('with_x/with_y do not mutate the receiver', () => {
    const top_left = Align2.LEFT_TOP;
    const flipped = top_left.flipped_x();
    expect(flipped.equals(Align2.RIGHT_TOP)).toBe(true);
    expect(top_left.equals(Align2.LEFT_TOP)).toBe(true);
    expect(flipped.flipped_y().equals(Align2.RIGHT_BOTTOM)).toBe(true);
    expect(top_left.equals(Align2.LEFT_TOP)).toBe(true);
  });

  it('exposes x and y alignment', () => {
    expect(Align2.LEFT_BOTTOM.x()).toBe('Min');
    expect(Align2.LEFT_BOTTOM.y()).toBe('Max');
    expect(Align2.CENTER_CENTER.to_sign().equals(vec2(0, 0))).toBe(true);
    expect(Align2.LEFT_BOTTOM.to_sign().equals(vec2(-1, 1))).toBe(true);
  });

  it('computes positions in a rect', () => {
    const r = Rect.from_min_max(pos2(0, 0), pos2(100, 50));
    expect(Align2.LEFT_TOP.pos_in_rect(r).equals(pos2(0, 0))).toBe(true);
    expect(Align2.CENTER_CENTER.pos_in_rect(r).equals(pos2(50, 25))).toBe(true);
    expect(Align2.RIGHT_BOTTOM.pos_in_rect(r).equals(pos2(100, 50))).toBe(true);
  });

  it('anchors a size inside a rect', () => {
    const r = Rect.from_min_max(pos2(0, 0), pos2(100, 50));
    const size = vec2(20, 10);
    expect(Align2.LEFT_TOP.anchor_size(pos2(0, 0), size).equals(Rect.from_min_max(pos2(0, 0), pos2(20, 10)))).toBe(true);
    expect(Align2.CENTER_CENTER.align_size_within_rect(size, r).equals(Rect.from_min_max(pos2(40, 20), pos2(60, 30)))).toBe(true);
    expect(center_size_in_rect(size, r).equals(Rect.from_min_max(pos2(40, 20), pos2(60, 30)))).toBe(true);
  });
});

describe('TSTransform', () => {
  // Doc-tests from emath/src/ts_transform.rs.
  it('transforms positions', () => {
    const ts = TSTransform.new(vec2(2.0, 3.0), 2.0);
    expect(ts.mul_pos(pos2(0.0, 0.0)).equals(pos2(2.0, 3.0))).toBe(true);
    expect(ts.mul_pos(pos2(5.0, 1.0)).equals(pos2(12.0, 5.0))).toBe(true);
  });

  it('inverts', () => {
    const p1 = pos2(2.0, 3.0);
    const p2 = pos2(12.0, 5.0);
    const ts = TSTransform.new(vec2(2.0, 3.0), 2.0);
    const inv = ts.inverse();
    expect(inv.mul_pos(p1).equals(pos2(0.0, 0.0))).toBe(true);
    expect(inv.mul_pos(p2).equals(pos2(5.0, 1.0))).toBe(true);
    expect(ts.inverse().inverse().equals(ts)).toBe(true);
  });

  it('transforms rects', () => {
    const rect = Rect.from_min_max(pos2(5.0, 5.0), pos2(15.0, 10.0));
    const ts = TSTransform.new(vec2(1.0, 0.0), 3.0);
    const transformed = ts.mul_rect(rect);
    expect(transformed.min.equals(pos2(16.0, 15.0))).toBe(true);
    expect(transformed.max.equals(pos2(46.0, 30.0))).toBe(true);
  });

  it('composes', () => {
    const ts1 = TSTransform.new(vec2(1.0, 0.0), 2.0);
    const ts2 = TSTransform.new(vec2(-1.0, -1.0), 3.0);
    const ts_combined = TSTransform.new(vec2(2.0, -1.0), 6.0);
    expect(ts_combined.equals(ts2.mul(ts1))).toBe(true);
  });

  it('reports validity', () => {
    expect(TSTransform.IDENTITY.is_valid()).toBe(true);
    expect(TSTransform.from_scaling(0.0).is_valid()).toBe(false);
  });
});

describe('RectTransform', () => {
  it('transforms positions and rects', () => {
    const t = RectTransform.from_to(Rect.from_min_max(pos2(0, 0), pos2(10, 10)), Rect.from_min_max(pos2(0, 0), pos2(20, 20)));
    expect(t.transform_pos(pos2(5, 5)).equals(pos2(10, 10))).toBe(true);
    expect(t.scale().equals(vec2(2, 2))).toBe(true);
    expect(t.inverse().transform_pos(pos2(10, 10)).equals(pos2(5, 5))).toBe(true);
  });

  it('clamps', () => {
    const t = RectTransform.from_to(Rect.from_min_max(pos2(0, 0), pos2(10, 10)), Rect.from_min_max(pos2(0, 0), pos2(20, 20)));
    expect(t.transform_pos_clamped(pos2(100, 100)).equals(pos2(20, 20))).toBe(true);
    expect(t.transform_pos_clamped(pos2(-100, -100)).equals(pos2(0, 0))).toBe(true);
  });
});

describe('Rot2', () => {
  it('rotates the X axis to the Y axis at 90 degrees', () => {
    const r = Rot2.from_angle(Math.PI / 2);
    const v = r.mul(Vec2.X);
    expect(Math.abs(v.x)).toBeLessThan(1e-6);
    expect(Math.abs(v.y - 1)).toBeLessThan(1e-6);
    expect(Math.abs(r.angle() - Math.PI / 2)).toBeLessThan(1e-6);
  });

  it('inverts and normalizes', () => {
    const r = Rot2.from_angle(0.7);
    const v = vec2(3, 4);
    const rotated = r.mul(v);
    expect(r.inverse().mul(rotated).equals(v)).toBe(true);
    expect(r.normalized().length()).toBeCloseTo(1);
  });

  it('composes', () => {
    const a = Rot2.from_angle(0.3);
    const b = Rot2.from_angle(0.5);
    const v = vec2(1, 2);
    // Composition is associative mathematically; compare with a tolerance since
    // the two orderings do different roundings.
    const lhs = a.mul(b).mul(v);
    const rhs = a.mul(b.mul(v));
    expect(lhs.x).toBeCloseTo(rhs.x, 6);
    expect(lhs.y).toBeCloseTo(rhs.y, 6);
  });
});

describe('RectAlign', () => {
  it('positions a child below its parent by default', () => {
    const parent = Rect.from_min_max(pos2(0, 0), pos2(100, 50));
    const child = RectAlign.BOTTOM_START.align_rect(parent, vec2(20, 10), 0);
    expect(child.equals(Rect.from_min_max(pos2(0, 50), pos2(20, 60)))).toBe(true);
  });

  it('respects a gap', () => {
    const parent = Rect.from_min_max(pos2(0, 0), pos2(100, 50));
    const no_gap = RectAlign.BOTTOM_START.align_rect(parent, vec2(20, 10), 0);
    const gap_5 = RectAlign.BOTTOM_START.align_rect(parent, vec2(20, 10), 5);
    expect(gap_5.top()).toBe(no_gap.top() + 5);
  });

  it('flips without corrupting the constants', () => {
    expect(RectAlign.BOTTOM_START.flipped_x().is(RectAlign.BOTTOM_END)).toBe(true);
    expect(RectAlign.BOTTOM_START.flipped_y().is(RectAlign.TOP_START)).toBe(true);
    expect(RectAlign.BOTTOM_START.flipped().is(RectAlign.TOP_END)).toBe(true);
    expect(RectAlign.BOTTOM_START.is(RectAlign.BOTTOM_START)).toBe(true);
    expect(RectAlign.BOTTOM_START.symmetries().length).toBe(3);
  });

  it('finds the best align that fits', () => {
    const parent = Rect.from_min_max(pos2(0, 0), pos2(100, 50));
    const content = Rect.from_min_max(pos2(0, 0), pos2(100, 100));
    const best = RectAlign.find_best_align(
      [RectAlign.TOP_START, RectAlign.BOTTOM_START],
      content,
      parent,
      0,
      vec2(20, 10),
    );
    expect(best).not.toBeNull();
    expect(best!.is(RectAlign.BOTTOM_START)).toBe(true);
  });

  it('returns null when there are no candidates', () => {
    expect(
      RectAlign.find_best_align([], Rect.EVERYTHING, Rect.EVERYTHING, 0, vec2(1, 1)),
    ).toBeNull();
  });

  it('computes gap vectors', () => {
    // A corner-aligned menu keeps the horizontal edges aligned, so the gap is
    // purely vertical, pointing away from the parent.
    expect(RectAlign.TOP_START.gap_vector().equals(vec2(0, -1))).toBe(true);
    expect(RectAlign.LEFT_START.gap_vector().equals(vec2(-1, 0))).toBe(true);
    // Edge-aligned menus get a single-component gap too.
    expect(RectAlign.TOP.gap_vector().equals(vec2(0, -1))).toBe(true);
    expect(RectAlign.RIGHT.gap_vector().equals(vec2(1, 0))).toBe(true);
  });
});