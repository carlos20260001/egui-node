import { describe, expect, it } from 'vitest';

import {
  almost_equal,
  ease_in_ease_out,
  exponential_smooth_factor,
  fast_midpoint,
  format_with_minimum_decimals,
  inverse_lerp,
  lerp,
  normalized_angle,
  remap_clamp,
  round_to_decimals,
} from './numeric.js';

const TAU = Math.PI * 2;

function almostEq(left: number, right: number): void {
  expect(Math.abs(left - right)).toBeLessThan(1e-6);
}

describe('lerp', () => {
  // From the doc-test in emath/src/lib.rs.
  it('interpolates linearly', () => {
    expect(lerp(1, 5, 0.0)).toBe(1);
    expect(lerp(1, 5, 0.5)).toBe(3);
    expect(lerp(1, 5, 1.0)).toBe(5);
    expect(lerp(1, 5, 2.0)).toBe(9);
  });
});

describe('fast_midpoint', () => {
  it('takes the midpoint', () => {
    expect(fast_midpoint(1.0, 5.0)).toBe(3.0);
  });
});

describe('inverse_lerp', () => {
  // From the doc-test in emath/src/lib.rs.
  it('finds the normalized position', () => {
    expect(inverse_lerp(1, 5, 1.0)).toBe(0.0);
    expect(inverse_lerp(1, 5, 3.0)).toBe(0.5);
    expect(inverse_lerp(1, 5, 5.0)).toBe(1.0);
    expect(inverse_lerp(1, 5, 9.0)).toBe(2.0);
    expect(inverse_lerp(1, 1, 3.0)).toBeNull();
  });
});

describe('remap_clamp', () => {
  // From `test_remap` in emath/src/lib.rs.
  it('handles inverted ranges', () => {
    expect(remap_clamp(1.0, 0.0, 1.0, 0.0, 16.0)).toBe(16.0);
    expect(remap_clamp(1.0, 1.0, 0.0, 16.0, 0.0)).toBe(16.0);
    expect(remap_clamp(0.5, 1.0, 0.0, 16.0, 0.0)).toBe(8.0);
  });
});

describe('round_to_decimals', () => {
  it('rounds to the given number of decimals', () => {
    expect(round_to_decimals(1.2345, 2)).toBe(1.23);
    expect(round_to_decimals(1.2355, 2)).toBe(1.24);
    expect(round_to_decimals(5, 0)).toBe(5);
  });
});

describe('format_with_minimum_decimals', () => {
  // From `test_format` in emath/src/lib.rs.
  it('uses as few decimals as needed', () => {
    expect(format_with_minimum_decimals(1234567.0, 0)).toBe('1234567');
    expect(format_with_minimum_decimals(1234567.0, 1)).toBe('1234567.0');
    expect(format_with_minimum_decimals(3.14, 2)).toBe('3.14');
    expect(format_with_minimum_decimals(3.14, 3)).toBe('3.140');
    expect(format_with_minimum_decimals(Math.PI, 2)).toBe('3.14159');
  });
});

describe('normalized_angle', () => {
  // From `test_normalized_angle` in emath/src/lib.rs.
  it('wraps to [-PI, PI]', () => {
    almostEq(normalized_angle(-3.0 * TAU), 0.0);
    almostEq(normalized_angle(-2.3 * TAU), -0.3 * TAU);
    almostEq(normalized_angle(-TAU), 0.0);
    almostEq(normalized_angle(0.0), 0.0);
    almostEq(normalized_angle(TAU), 0.0);
    almostEq(normalized_angle(2.7 * TAU), -0.3 * TAU);
  });
});

describe('almost_equal', () => {
  it('is reflexive and tolerant', () => {
    expect(almost_equal(1.0, 1.0, 1e-7)).toBe(true);
    expect(almost_equal(1.0, 1.0000001, 1e-6)).toBe(true);
    expect(almost_equal(1.0, 1.1, 1e-6)).toBe(false);
    expect(almost_equal(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, 1e-7)).toBe(true);
  });
});

describe('exponential_smooth_factor', () => {
  it('approaches the requested reach at the requested time', () => {
    const dt = 1.0 / 60.0;
    const t = exponential_smooth_factor(0.9, 1.0, dt);
    let value = 0.0;
    // Integrating the factor for one second should land near 0.9.
    for (let i = 0; i < 60; i++) {
      value = lerp(value, 1.0, exponential_smooth_factor(0.9, 1.0, dt));
    }
    almostEq(value, 0.9);
    expect(t).toBeGreaterThan(0);
  });
});

describe('ease_in_ease_out', () => {
  it('is clamped to [0, 1] with flat ends', () => {
    expect(ease_in_ease_out(0)).toBe(0);
    expect(ease_in_ease_out(1)).toBe(1);
    expect(ease_in_ease_out(0.5)).toBe(0.5);
    expect(ease_in_ease_out(-1)).toBe(0);
    expect(ease_in_ease_out(2)).toBe(1);
  });
});