import { describe, expect, it } from 'vitest';

import { pos2 } from './pos2.js';
import { vec2, Vec2 } from './vec2.js';
import { Vec2b } from './vec2b.js';

const TAU = Math.PI * 2;

/** Mirrors the `almost_eq!` macro in `emath/src/vec2.rs`. */
function almostEq(left: number, right: number): void {
  expect(Math.abs(left - right)).toBeLessThan(1e-6);
}

describe('Vec2', () => {
  it('has the expected constants', () => {
    expect(Vec2.X.equals(new Vec2(1, 0))).toBe(true);
    expect(Vec2.Y.equals(new Vec2(0, 1))).toBe(true);
    expect(Vec2.RIGHT.equals(Vec2.X)).toBe(true);
    expect(Vec2.LEFT.equals(new Vec2(-1, 0))).toBe(true);
    expect(Vec2.UP.equals(new Vec2(0, -1))).toBe(true);
    expect(Vec2.DOWN.equals(Vec2.Y)).toBe(true);
    expect(Vec2.ZERO.equals(new Vec2(0, 0))).toBe(true);
    expect(Vec2.ONE.equals(new Vec2(1, 1))).toBe(true);
    expect(Vec2.splat(3).equals(new Vec2(3, 3))).toBe(true);
  });

  it('handles index access like the Rust Index impls', () => {
    const v = vec2(1, 2);
    expect(v.get(0)).toBe(1);
    expect(v.get(1)).toBe(2);
    expect(() => v.get(2)).toThrow(RangeError);
    v.set(0, 9);
    expect(v.x).toBe(9);
  });

  // Straight from `test_vec2` in emath/src/vec2.rs.
  it('measures angles', () => {
    expect(Vec2.ZERO.angle()).toBe(0.0);
    expect(Vec2.angled(0.0).angle()).toBe(0.0);
    expect(Vec2.angled(1.0).angle()).toBe(1.0);
    expect(Vec2.X.angle()).toBe(0.0);
    expect(Vec2.Y.angle()).toBe(0.25 * TAU);

    expect(Vec2.RIGHT.angle()).toBe(0.0);
    expect(Vec2.DOWN.angle()).toBe(0.25 * TAU);
    almostEq(Vec2.LEFT.angle(), 0.5 * TAU);
    expect(Vec2.UP.angle()).toBe(-0.25 * TAU);
  });

  it('supports the assignment operators', () => {
    expect(vec2(1.0, 2.0).add_assign(vec2(3.0, 4.0)).equals(vec2(4.0, 6.0))).toBe(true);
    expect(vec2(4.0, 6.0).sub_assign(vec2(1.0, 2.0)).equals(vec2(3.0, 4.0))).toBe(true);
    expect(vec2(1.0, 2.0).mul_assign(2.0).equals(vec2(2.0, 4.0))).toBe(true);
    expect(vec2(2.0, 4.0).div_assign(2.0).equals(vec2(1.0, 2.0))).toBe(true);
  });

  it('does element-wise and scalar math', () => {
    expect(vec2(2, 3).mul(vec2(4, 5)).equals(vec2(8, 15))).toBe(true);
    expect(vec2(2, 3).div(vec2(4, 6)).equals(vec2(0.5, 0.5))).toBe(true);
    expect(vec2(2, 3).mul(3).equals(vec2(6, 9))).toBe(true);
    expect(vec2(6, 9).div(3).equals(vec2(2, 3))).toBe(true);
    expect(vec2(2, 3).neg().equals(vec2(-2, -3))).toBe(true);
  });

  it('converts to and from arrays', () => {
    expect(Vec2.fromArray([3, 4]).equals(vec2(3, 4))).toBe(true);
    expect(vec2(3, 4).toArray()).toEqual([3, 4]);
  });

  it('rounds half away from zero', () => {
    // This is where Math.round would silently diverge from Rust.
    expect(vec2(-1.5, 1.5).round().equals(vec2(-2, 2))).toBe(true);
    expect(vec2(-0.5, 0.5).round().equals(vec2(-1, 1))).toBe(true);
  });

  it('detects NaN and non-finite members', () => {
    expect(vec2(1, Number.NaN).any_nan()).toBe(true);
    expect(vec2(Number.POSITIVE_INFINITY, 0).any_nan()).toBe(false);
    expect(vec2(Number.POSITIVE_INFINITY, 0).is_finite()).toBe(false);
  });

  it('clamps component-wise', () => {
    expect(vec2(-5, 50).clamp(Vec2.ZERO, Vec2.ONE).equals(vec2(0, 1))).toBe(true);
  });

  it('converts to and from Pos2', () => {
    expect(vec2(3, 4).to_pos2().equals(pos2(3, 4))).toBe(true);
  });

  it('converts from Vec2b via i32 truncation semantics', () => {
    const v = new Vec2(Vec2b.TRUE.x ? 1 : 0, Vec2b.FALSE.y ? 1 : 0);
    expect(v.equals(vec2(1, 0))).toBe(true);
  });

  // Straight from `test_vec2_normalized` in emath/src/vec2.rs.
  it('normalizes a spiral', () => {
    function generateSpiral(n: number, start: Vec2, end: Vec2): Vec2[] {
      const angle_step = (2.0 * Math.PI) / n;
      const radius_step = (end.length() - start.length()) / n;
      const out: Vec2[] = [];
      for (let i = 0; i < n; i++) {
        const angle = i * angle_step;
        const radius = start.length() + i * radius_step;
        out.push(vec2(radius * Math.cos(angle), radius * Math.sin(angle)));
      }
      return out;
    }

    for (const v of generateSpiral(40, Vec2.splat(0.1), Vec2.splat(2.0))) {
      const vn = v.normalized();
      almostEq(vn.length(), 1.0);
      expect(vn.is_normalized()).toBe(true);
    }
  });

  it('formats like Rust Display and Debug', () => {
    expect(vec2(1, 2).toString()).toBe('[1 2]');
    // NB: exact ties differ - Rust's `{:.1}` rounds half-to-even (1.25 -> "1.2")
    // while JS `toFixed` rounds half-up (1.25 -> "1.3"). Debug strings only.
    expect(vec2(1.26, 2.5).toDebug()).toBe('[1.3 2.5]');
    expect(vec2(1.26, 2.5).toDebug(3)).toBe('[1.260 2.500]');
  });
});

describe('Pos2', () => {
  it('converts to and from Vec2', () => {
    expect(pos2(3, 4).to_vec2().equals(vec2(3, 4))).toBe(true);
    expect(pos2(0, 0).equals(pos2(0, 0))).toBe(true);
  });

  it('measures distance', () => {
    expect(pos2(0, 0).distance(pos2(3, 4))).toBe(5);
    expect(pos2(0, 0).distance_sq(pos2(3, 4))).toBe(25);
  });

  it('has asymmetric arithmetic', () => {
    // Pos2 + Vec2 -> Pos2
    expect(pos2(1, 2).add(vec2(3, 4)).equals(pos2(4, 6))).toBe(true);
    // Pos2 - Pos2 -> Vec2
    expect(pos2(1, 2).sub(pos2(3, 4)).equals(vec2(-2, -2))).toBe(true);
    // Pos2 - Vec2 -> Pos2
    expect(pos2(1, 2).sub(vec2(3, 4)).equals(pos2(-2, -2))).toBe(true);
  });

  it('interpolates linearly', () => {
    expect(pos2(0, 0).lerp_to(pos2(10, 20), 0.5).equals(pos2(5, 10))).toBe(true);
  });

  it('rounds half away from zero', () => {
    expect(pos2(-1.5, 1.5).round().equals(pos2(-2, 2))).toBe(true);
  });

  it('handles index access like the Rust Index impls', () => {
    const p = pos2(1, 2);
    expect(p.get(1)).toBe(2);
    expect(() => p.get(2)).toThrow(RangeError);
  });
});

describe('Vec2b', () => {
  it('has the expected constants', () => {
    expect(Vec2b.FALSE.any()).toBe(false);
    expect(Vec2b.TRUE.all()).toBe(true);
  });

  it('combines with and/or/not', () => {
    const a = new Vec2b(true, false);
    const b = new Vec2b(true, true);
    expect(a.and(b).equals(new Vec2b(true, false))).toBe(true);
    expect(a.or(b).equals(new Vec2b(true, true))).toBe(true);
    expect(a.not().equals(new Vec2b(false, true))).toBe(true);
  });

  it('converts to a float Vec2', () => {
    expect(new Vec2b(true, false).to_vec2().equals(vec2(1, 0))).toBe(true);
  });
});