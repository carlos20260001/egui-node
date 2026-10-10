/**
 * Scalar helpers, ported from `emath/src/lib.rs`.
 *
 * Rust's `..=` ranges have no direct JS equivalent, so `lerp(a..=b, t)` is
 * spelled `lerp(a, b, t)`. The `Rangef` type (see `range.ts`) is available for
 * the cases where the range is a value in its own right.
 */

import { f32Max, f32Min, f32Fixed } from './f32util.js';

/** Rust: `Trait One` / `Trait Real`, which exist only to enable `lerp`/`remap`. */
export interface Real {
  // Marker interface; JS numbers carry the operations directly.
}

/**
 * Linear interpolation: `(1 - t) * start + t * end`, evaluated in that exact
 * order so the floating-point rounding matches the Rust crate.
 *
 * ```
 * lerp(1, 5, 0.0) === 1
 * lerp(1, 5, 0.5) === 3
 * lerp(1, 5, 1.0) === 5
 * lerp(1, 5, 2.0) === 9
 * ```
 */
export function lerp(start: number, end: number, t: number): number {
  return (1 - t) * start + t * end;
}

/**
 * A faster version of `f32::midpoint` which doesn't handle overflow.
 */
export function fast_midpoint(a: number, b: number): number {
  return (a + b) / 2;
}

/**
 * Where in the range is this value? Returns 0-1 if within the range.
 *
 * Returns <0 if before and >1 if after.
 *
 * Returns `null` if the input range is zero-width.
 *
 * ```
 * inverse_lerp(1, 5, 1.0) === 0.0
 * inverse_lerp(1, 5, 3.0) === 0.5
 * inverse_lerp(1, 5, 9.0) === 2.0
 * inverse_lerp(1, 1, 3.0) === null
 * ```
 */
export function inverse_lerp(min: number, max: number, value: number): number | null {
  if (min === max) {
    return null;
  }
  return (value - min) / (max - min);
}

/**
 * Linearly remap a value from one range to another,
 * so that when `x === from.start()` returns `to.start()`
 * and when `x === from.end()` returns `to.end()`.
 */
export function remap(x: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  const t = (x - fromMin) / (fromMax - fromMin);
  return lerp(toMin, toMax, t);
}

/**
 * Like {@link remap}, but also clamps the value so that the returned value is
 * always in the `to` range.
 */
export function remap_clamp(
  x: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  // Rust handles an inverted `from` range by recursing with it flipped.
  if (fromMax < fromMin) {
    return remap_clamp(x, fromMax, fromMin, toMax, toMin);
  }
  if (x <= fromMin) {
    return toMin;
  }
  if (fromMax <= x) {
    return toMax;
  }
  const t = (x - fromMin) / (fromMax - fromMin);
  // Ensure no numerical inaccuracies sneak in:
  return 1 <= t ? toMax : lerp(toMin, toMax, t);
}

/** Round a value to the given number of decimal places. */
export function round_to_decimals(value: number, decimal_places: number): number {
  // This is a stupid way of doing this, but stupid works.
  const parsed = Number.parseFloat(f32Fixed(value, decimal_places));
  return Number.isNaN(parsed) ? value : parsed;
}

/** Format with at least `decimals` decimals, but no more than 6. */
export function format_with_minimum_decimals(value: number, decimals: number): string {
  return format_with_decimals_in_range(value, decimals, 6);
}

/**
 * Use as few decimals as possible to show the value accurately, but within the
 * given range. Decimals are counted after the decimal point.
 */
export function format_with_decimals_in_range(value: number, min_decimals: number, max_decimals: number): string {
  if (min_decimals > max_decimals) {
    throw new RangeError(
      `format_with_decimals_in_range: min_decimals (${min_decimals}) should be <= max_decimals (${max_decimals})`,
    );
  }
  if (max_decimals >= 100) {
    throw new RangeError(`format_with_decimals_in_range: max_decimals (${max_decimals}) should be < 100`);
  }
  const maxDecimals = Math.min(max_decimals, 16);
  const minDecimals = Math.min(min_decimals, maxDecimals);

  if (minDecimals < maxDecimals) {
    // Ugly/slow way of doing this, mirroring the Rust implementation.
    for (let decimals = minDecimals; decimals < maxDecimals; decimals++) {
      const text = f32Fixed(value, decimals);
      const epsilon = 16 * 1.1920929e-7; // margin large enough for most round-tripping needs
      const parsed_value = Number.parseFloat(text);
      if (!Number.isNaN(parsed_value) && almost_equal(parsed_value, value, epsilon)) {
        // Enough precision to show the value accurately - good!
        return text;
      }
    }
    // The value has more precision than we expected.
    // Probably the value was set not by the slider, but from outside.
    // In any case: show the full value.
  }
  return f32Fixed(value, maxDecimals);
}

/**
 * Return true when arguments are the same within some rounding error.
 *
 * For instance `almost_equal(x, x.toDegrees().toRadians(), EPSILON)` should
 * hold true for all x. The `epsilon` can be `EPSILON` to handle simple
 * transforms (like degrees -> radians) but should be higher to handle more
 * complex transformations.
 */
export function almost_equal(a: number, b: number, epsilon: number): boolean {
  if (a === b) {
    return true; // handle infinities
  }
  const abs_max = f32Max(Math.abs(a), Math.abs(b));
  return abs_max <= epsilon || Math.abs(a - b) / abs_max <= epsilon;
}

/** Wrap angle to the `[-PI, PI]` range. */
export function normalized_angle(angle: number): number {
  const TAU = Math.PI * 2;
  angle %= TAU;
  if (angle > Math.PI) {
    angle -= TAU;
  } else if (angle < -Math.PI) {
    angle += TAU;
  }
  return angle;
}

/**
 * Calculate a lerp-factor for exponential smoothing using a time step.
 *
 * * `exponential_smooth_factor(0.90, 1.0, dt)`: reach 90% in 1.0 seconds
 * * `exponential_smooth_factor(0.50, 0.2, dt)`: reach 50% in 0.2 seconds
 */
export function exponential_smooth_factor(
  reach_this_fraction: number,
  in_this_many_seconds: number,
  dt: number,
): number {
  return 1 - Math.pow(1 - reach_this_fraction, dt / in_this_many_seconds);
}

/**
 * If you have a value animating over time, how much towards its target do you
 * need to move it this frame?
 */
export function interpolation_factor(
  timeSpan: readonly [number, number],
  current_time: number,
  dt: number,
  easing: (t: number) => number,
): number {
  const [start_time, end_time] = timeSpan;
  const animation_duration = (end_time - start_time) as number;
  const prev_time = current_time - (dt as number);
  const prev_t = easing((prev_time - start_time) / animation_duration);
  const end_t = easing((current_time - start_time) / animation_duration);
  if (end_t < 1.0) {
    return (end_t - prev_t) / (1 - prev_t);
  }
  return 1.0;
}

/**
 * Ease in, ease out.
 *
 * `f(0) = 0, f'(0) = 0, f(1) = 1, f'(1) = 0`.
 */
export function ease_in_ease_out(t: number): number {
  const c = Math.min(Math.max(t, 0), 1);
  return Math.min(Math.max(3 * c * c - 2 * c * c * c, 0), 1);
}

/**
 * Extends numbers, `Vec2` etc. with `at_least` / `at_most`, which are the
 * readable aliases for `max` / `min` from the `NumExt` trait.
 */
export function at_least(a: number, lower_limit: number): number {
  return f32Max(a, lower_limit);
}

/** See {@link at_least}. */
export function at_most(a: number, upper_limit: number): number {
  return f32Min(a, upper_limit);
}