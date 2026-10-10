import { describe, expect, it } from 'vitest';

import {
  ALL_EASINGS,
  EASINGS,
  bounce_out,
  cubic_in_out,
  linear,
  quadratic_in,
  sin_in,
  sin_in_out,
  sin_out,
} from './easing.js';
import { History } from './history.js';
import { cmp_ordered_float, sort_ordered } from './ordered_float.js';
import { best_in_range_f64 } from './smart_aim.js';

describe('easing', () => {
  it('provides a linear curve', () => {
    expect(linear(0.3)).toBe(0.3);
    expect(linear(0)).toBe(0);
    expect(linear(1)).toBe(1);
  });

  it('starts at 0 and ends at 1 for the well-behaved curves', () => {
    for (const { name, fn } of ALL_EASINGS) {
      if (name === 'back_in' || name === 'back_out' || name === 'back_in_out') {
        continue; // intentionally overshoot
      }
      if (name === 'sin_in' || name === 'sin_out') {
        continue; // see the upstream-quirk test below
      }
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 6);
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 6);
    }
  });

  it('upstream quirk: sin_in/sin_out oscillate instead of easing', () => {
    // emath/src/easing.rs computes `sin_in(t) = sin((t-1) * 2 * PI) + 1` and
    // `sin_out(t) = sin(t * 2 * PI)`. The reference curves on
    // https://easings.net use a `PI / 2` factor:
    //   easeInSine  = sin((t - 1) * PI/2) + 1   (monotonic 0 -> 1)
    //   easeOutSine = sin(t * PI/2)             (monotonic 0 -> 1)
    // With `2 * PI` the argument sweeps a full period over [0, 1], so both
    // oscillate over a full cycle instead of easing.
    //
    // We port them verbatim rather than "fixing" them, so the Node port matches
    // the Rust crate. Flagged upstream rather than silently diverged.
    // Note `sin_in_out` is correct and does ease.
    expect(sin_in(0.0)).toBeCloseTo(1, 6); // sin(-2pi)  + 1
    expect(sin_in(0.25)).toBeCloseTo(2, 6); // sin(-3pi/2) + 1
    expect(sin_in(0.5)).toBeCloseTo(1, 6); // sin(-pi)   + 1
    expect(sin_in(0.75)).toBeCloseTo(0, 6); // sin(-pi/2) + 1
    expect(sin_in(1.0)).toBeCloseTo(1, 6); // sin(0)     + 1

    expect(sin_out(0.0)).toBeCloseTo(0, 6); // sin(0)
    expect(sin_out(0.25)).toBeCloseTo(1, 6); // sin(pi/2)
    expect(sin_out(0.5)).toBeCloseTo(0, 6); // sin(pi)
    expect(sin_out(0.75)).toBeCloseTo(-1, 6); // sin(3pi/2)
    expect(sin_out(1.0)).toBeCloseTo(0, 6); // sin(2pi)

    // `sin_in_out` matches easings.net and is unaffected.
    expect(sin_in_out(0)).toBeCloseTo(0, 6);
    expect(sin_in_out(0.5)).toBeCloseTo(0.5, 6);
    expect(sin_in_out(1)).toBeCloseTo(1, 6);
  });

  it('matches the reference formulas', () => {
    expect(quadratic_in(0.5)).toBe(0.25);
    expect(cubic_in_out(0.25)).toBeCloseTo(4 * 0.25 ** 3, 6);
    expect(bounce_out(0)).toBe(0);
    expect(EASINGS.linear).toBe(linear);
  });

  it('exposes every easing by name', () => {
    expect(Object.keys(EASINGS).length).toBe(22);
    expect(ALL_EASINGS.length).toBe(22);
  });
});

// Straight from `test_aim` in emath/src/smart_aim.rs.
describe('smart_aim', () => {
  it('finds the simplest number in a range', () => {
    expect(best_in_range_f64(0.0799999999999996, 0.09999999999999995)).toBe(0.08);
    expect(best_in_range_f64(7.8, 17.8)).toBe(10.0);
    expect(best_in_range_f64(99.0, 300.0)).toBe(100.0);
    expect(best_in_range_f64(-99.0, -300.0)).toBe(-100.0);
    expect(best_in_range_f64(0.4, 0.9)).toBe(0.5); // Prefer ending on 5
    expect(best_in_range_f64(14.1, 19.99)).toBe(15.0); // Prefer ending on 5
    expect(best_in_range_f64(12.3, 65.9)).toBe(50.0); // Prefer leading 5
    expect(best_in_range_f64(493.0, 879.0)).toBe(500.0); // Prefer leading 5
    expect(best_in_range_f64(0.37, 0.48)).toBe(0.40);
    expect(best_in_range_f64(7.5, 16.3)).toBe(10.0);
    expect(best_in_range_f64(7.5, 76.3)).toBe(10.0);
    expect(best_in_range_f64(7.5, 763.3)).toBe(100.0);
    expect(best_in_range_f64(7.5, 1345.0)).toBe(100.0);
    expect(best_in_range_f64(7.5, 123456.0)).toBe(1000.0); // Geometric mean
    expect(best_in_range_f64(9.9999, 99.999)).toBe(10.0);
    expect(best_in_range_f64(10.0, 99.999)).toBe(10.0);
    expect(best_in_range_f64(10.001, 99.999)).toBe(50.0);
    expect(best_in_range_f64(10.001, 100.0)).toBe(100.0);
    expect(best_in_range_f64(99.999, 100.0)).toBe(100.0);
    expect(best_in_range_f64(10.001, 100.001)).toBe(100.0);
  });

  it('always prefers zero', () => {
    expect(best_in_range_f64(-0.2, 0.0)).toBe(0.0);
    expect(best_in_range_f64(-10004.23, 3.14)).toBe(0.0);
    expect(best_in_range_f64(-0.2, 100.0)).toBe(0.0);
    expect(best_in_range_f64(0.2, 0.0)).toBe(0.0);
  });

  it('handles NaN and infinity', () => {
    expect(Number.isNaN(best_in_range_f64(Number.NaN, Number.NaN))).toBe(true);
    expect(best_in_range_f64(Number.NaN, 1.2)).toBe(1.2);
    expect(best_in_range_f64(Number.NaN, Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(best_in_range_f64(1.2, Number.NaN)).toBe(1.2);
    expect(best_in_range_f64(1.2, Number.POSITIVE_INFINITY)).toBe(1.2);
    expect(best_in_range_f64(Number.POSITIVE_INFINITY, 1.2)).toBe(1.2);
    expect(best_in_range_f64(Number.NEGATIVE_INFINITY, 1.2)).toBe(0.0);
    expect(best_in_range_f64(Number.NEGATIVE_INFINITY, -2.7)).toBe(-2.7);
    expect(best_in_range_f64(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(best_in_range_f64(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)).toBe(
      Number.NEGATIVE_INFINITY,
    );
    expect(best_in_range_f64(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(0.0);
    expect(best_in_range_f64(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)).toBe(0.0);
  });

  it('aims at round integers', () => {
    const test = (min: number, max: number, expected: number) => {
      const aimed = best_in_range_f64(min, max);
      expect(aimed, `smart_aim(${min} - ${max}) => ${aimed}, expected ${expected}`).toBe(expected);
    };

    test(99, 300, 100);
    test(300, 99, 100);
    test(-99, -300, -100);
    test(-99, 123, 0); // Prefer zero
    test(4, 9, 5); // Prefer ending on 5
    test(14, 19, 15); // Prefer ending on 5
    test(12, 65, 50); // Prefer leading 5
    test(493, 879, 500); // Prefer leading 5
    test(37, 48, 40);
    test(100, 123, 100);
    test(101, 1000, 1000);
    test(999, 1000, 1000);
    test(123, 500, 500);
    test(500, 777, 500);
    test(500, 999, 500);
    test(12345, 12780, 12500);
    test(12371, 12376, 12375);
  });
});

describe('History', () => {
  // The doc-test on `History::new` in emath/src/history.rs.
  it('averages values', () => {
    const history = new History<number>({ start: 2, end: 100 }, 1.0);
    expect(history.average()).toBeUndefined();
    history.add(0.0, 40.0);
    history.add(0.0, 44.0);
    expect(history.average()).toBe(42.0);
  });

  it('drops values older than max_age but never below min_len', () => {
    const history = new History<number>({ start: 2, end: 100 }, 1.0);
    history.add(0.0, 1.0);
    history.add(0.1, 2.0);
    // Adding at t=100 flushes everything older than 99, down to min_len = 2.
    history.add(100.0, 3.0);
    expect(history.values()).toEqual([2, 3]);

    // One more keeps the window rolling.
    history.add(101.0, 4.0);
    expect(history.values()).toEqual([3, 4]);
  });

  it('respects max_len', () => {
    const history = new History<number>({ start: 0, end: 3 }, 1e9);
    for (let i = 0; i < 10; i++) {
      history.add(i, i);
    }
    expect(history.len()).toBe(3);
    expect(history.total_count()).toBe(10n);
  });

  it('computes rate, duration and velocity', () => {
    const history = new History<number>({ start: 0, end: 100 }, 1e9);
    expect(history.duration()).toBe(0.0);
    expect(history.rate()).toBeUndefined();
    expect(history.velocity()).toBeUndefined();

    history.add(0.0, 0.0);
    history.add(1.0, 10.0);
    expect(history.duration()).toBe(1.0);
    expect(history.rate()).toBe(1.0);
    expect(history.velocity()).toBe(10.0);
    expect(history.bandwidth()).toBe(5.0);
  });

  it('rejects time going backwards', () => {
    const history = new History<number>({ start: 0, end: 100 }, 1e9);
    history.add(1.0, 1.0);
    expect(() => history.add(0.0, 2.0)).toThrow();
  });
});

describe('ordered float', () => {
  it('sorts', () => {
    expect(sort_ordered([1.0, 2.5, 2.0])).toEqual([1.0, 2.0, 2.5]);
  });

  it('sorts NaN last and considers all NaNs equal', () => {
    expect(cmp_ordered_float(Number.NaN, 1.0)).toBe(1);
    expect(cmp_ordered_float(1.0, Number.NaN)).toBe(-1);
    expect(cmp_ordered_float(Number.NaN, Number.NaN)).toBe(0);
  });

  it('ignores the sign of zero', () => {
    expect(cmp_ordered_float(-0.0, 0.0)).toBe(0);
  });
});