/**
 * Rust `f32` semantics that differ from JavaScript.
 *
 * egui is written in Rust against `f32`, whose float primitives are *not*
 * the same as the ECMAScript `Math` ones. Porting the math verbatim with
 * `Math.*` silently changes behaviour in the NaN and negative-rounding cases,
 * and those cases show up in bounding-box and rounding code. Everything in
 * this module reproduces the Rust behaviour so the rest of the port can call
 * plain-looking helpers.
 *
 * Precision note: `emath` stores `f32`, while JavaScript numbers are `f64`.
 * This port stores `f64` for speed and accuracy. The values agree with the
 * Rust crate to well under a pixel; the one place it can diverge is text
 * layout, which is quantised to font pixels anyway.
 */

/** `f32::MIN` / `f64::MIN`: largest negative finite value. */
export const F_MIN = -3.4028234663852886e38;

/** `f32::MAX` / `f64::MAX`: largest positive finite value. */
export const F_MAX = 3.4028234663852886e38;

/** `f32::EPSILON`. */
export const F_EPSILON = 1.1920929e-7;

/** `f32::MIN_POSITIVE`: smallest positive *normal* value. */
export const F_MIN_POSITIVE = 1.1754944e-38;

/** `f32::INFINITY`. */
export const F_INFINITY = Number.POSITIVE_INFINITY;

/** `f32::NAN`. */
export const F_NAN = Number.NaN;

export function isFinite(v: number): boolean {
  return Number.isFinite(v);
}

export function isNan(v: number): boolean {
  return Number.isNaN(v);
}

export function isInf(v: number): boolean {
  return v === Number.POSITIVE_INFINITY || v === Number.NEGATIVE_INFINITY;
}

/**
 * Rust `f32::min` / `f64::min`.
 *
 * Unlike `Math.min`, this returns the *other* operand when one of them is NaN
 * (IEEE 754-2008 `minNum`), instead of propagating the NaN.
 */
export function f32Min(a: number, b: number): number {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  return a < b ? a : b;
}

/**
 * Rust `f32::max` / `f64::max`.
 *
 * Unlike `Math.max`, this returns the *other* operand when one of them is NaN
 * (IEEE 754-2008 `maxNum`), instead of propagating the NaN.
 */
export function f32Max(a: number, b: number): number {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  return a > b ? a : b;
}

/**
 * Rust `f32::round`: round half *away from zero*.
 *
 * `Math.round` instead rounds half *toward* positive infinity, so the two
 * disagree for every negative `.5`: `f32Round(-1.5) === -2` while
 * `Math.round(-1.5) === -1`.
 */
export function f32Round(v: number): number {
  // Fast path for the overwhelmingly common non-negative case.
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

/**
 * Rust `f32::trunc`: round toward zero. Same as `Math.trunc`.
 */
export function f32Trunc(v: number): number {
  return Math.trunc(v);
}

/**
 * Rust `f32::clamp`.
 *
 * Rust asserts `min <= max`; passing an inverted range is a programming error,
 * so we throw rather than silently return something arbitrary. A NaN input
 * falls through both comparisons and is returned as NaN, matching Rust.
 */
export function f32Clamp(v: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError(`f32Clamp: min (${min}) must be <= max (${max})`);
  }
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/** Rust `f32::signum`: `-1.0`, `0.0`, `+1.0`, or NaN. */
export function f32Signum(v: number): number {
  if (Number.isNaN(v)) return F_NAN;
  if (v > 0) return 1;
  if (v < 0) return -1;
  // Rust preserves the sign of zero: signum(-0.0) == -0.0.
  return Object.is(v, -0) ? -0 : 0;
}

/** Rust `f32::to_radians`. */
export function f32ToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Rust `f32::to_degrees`. */
export function f32ToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Rust `f32::powf`. */
export function f32Powf(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

/** Rust `f32::rem_euclid`: a non-negative remainder, unlike `%`. */
export function f32RemEuclid(rhs: number, lhs: number): number {
  const r = rhs % lhs;
  if (r !== 0 && r < 0) {
    return r + Math.abs(lhs);
  }
  return r;
}

/** Format a float the way Rust's `{}` does for `f32`/`f64`: shortest round-trip. */
export function f32Display(v: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Number.POSITIVE_INFINITY) return 'inf';
  if (v === Number.NEGATIVE_INFINITY) return '-inf';
  return String(v);
}

/** Rust's `{:.N}` float formatting, i.e. `format!("{value:.N$}")`. */
export function f32Fixed(v: number, decimals: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Number.POSITIVE_INFINITY) return 'inf';
  if (v === Number.NEGATIVE_INFINITY) return '-inf';
  return v.toFixed(decimals);
}