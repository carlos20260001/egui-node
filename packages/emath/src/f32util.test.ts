import { describe, expect, it } from 'vitest';

import {
  F_MIN_POSITIVE,
  f32Clamp,
  f32Display,
  f32Max,
  f32Min,
  f32Round,
  f32Signum,
  f32ToDegrees,
  f32ToRadians,
} from './f32util.js';

const TAU = Math.PI * 2;
const EPSILON = 1.1920929e-7;

describe('Rust f32 semantics', () => {
  it('f32Min returns the non-NaN operand, unlike Math.min', () => {
    expect(f32Min(1, 2)).toBe(1);
    expect(f32Min(2, 1)).toBe(1);
    expect(Number.isNaN(Math.min(Number.NaN, 1))).toBe(true);
    expect(f32Min(Number.NaN, 1)).toBe(1);
    expect(f32Min(1, Number.NaN)).toBe(1);
    expect(Number.isNaN(f32Min(Number.NaN, Number.NaN))).toBe(true);
  });

  it('f32Max returns the non-NaN operand, unlike Math.max', () => {
    expect(f32Max(1, 2)).toBe(2);
    expect(f32Max(Number.NaN, 1)).toBe(1);
    expect(f32Max(1, Number.NaN)).toBe(1);
  });

  it('f32Round rounds half away from zero, unlike Math.round', () => {
    // The whole reason this shim exists.
    expect(Math.round(-1.5)).toBe(-1);
    expect(f32Round(-1.5)).toBe(-2);
    expect(f32Round(1.5)).toBe(2);
    expect(f32Round(-0.5)).toBe(-1);
    expect(f32Round(0.5)).toBe(1);
    expect(f32Round(2.4)).toBe(2);
    expect(f32Round(-2.6)).toBe(-3);
  });

  it('f32Clamp panics on an inverted range', () => {
    expect(f32Clamp(5, 0, 10)).toBe(5);
    expect(f32Clamp(-5, 0, 10)).toBe(0);
    expect(f32Clamp(50, 0, 10)).toBe(10);
    expect(() => f32Clamp(5, 10, 0)).toThrow(RangeError);
  });

  it('f32Clamp passes NaN through, matching Rust', () => {
    expect(Number.isNaN(f32Clamp(Number.NaN, 0, 10))).toBe(true);
  });

  it('f32Signum preserves the sign of zero', () => {
    expect(f32Signum(-3)).toBe(-1);
    expect(f32Signum(3)).toBe(1);
    expect(Object.is(f32Signum(-0), -0)).toBe(true);
  });

  it('degree/radian round-trips within f32::EPSILON', () => {
    // Mirrors `test_almost_equal` in emath/src/lib.rs.
    const almostEqual = (a: number, b: number, epsilon: number): boolean => {
      if (a === b) return true;
      const absMax = f32Max(Math.abs(a), Math.abs(b));
      return absMax <= epsilon || Math.abs(a - b) / absMax <= epsilon;
    };

    const values = [0.0, F_MIN_POSITIVE, 1e-20, 1e-10, EPSILON, 0.1, 0.99, 1.0, 1.001, 1e10, 3.4e37, Number.POSITIVE_INFINITY];

    for (const base of values) {
      for (const x of [-base, base]) {
        for (const roundtrip of [
          (v: number) => f32ToRadians(f32ToDegrees(v)),
          (v: number) => f32ToDegrees(f32ToRadians(v)),
        ]) {
          expect(almostEqual(x, roundtrip(x), EPSILON)).toBe(true);
        }
      }
    }
  });

  it('formats floats the way Rust does', () => {
    expect(f32Display(Number.NaN)).toBe('NaN');
    expect(f32Display(Number.POSITIVE_INFINITY)).toBe('inf');
    expect(f32Display(Number.NEGATIVE_INFINITY)).toBe('-inf');
    expect(f32Display(1.5)).toBe('1.5');
  });
});

describe('TAU sanity', () => {
  it('is 2*PI', () => {
    expect(TAU).toBe(Math.PI * 2);
  });
});