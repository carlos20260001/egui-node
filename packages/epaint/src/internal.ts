/**
 * Integer helpers for the fixed-width types epaint stores things in.
 *
 * `Margin` is four `i8`s and `CornerRadius` is four `u8`s, chosen so those
 * structs stay small. JavaScript has no integer types, so the fields are plain
 * numbers and these helpers reproduce Rust's semantics.
 *
 * The important one is the `as` cast, which **truncates toward zero and
 * saturates** to the target range. `Math.trunc` and `| 0` truncate but do not
 * saturate, so without these a value of 200 silently wraps to a negative
 * number and corrupts every layout calculation downstream.
 */

export const I8_MIN = -128;
export const I8_MAX = 127;
export const U8_MIN = 0;
export const U8_MAX = 255;

/** Rust `f32 as i8`: truncate toward zero, then saturate to `[-128, 127]`. */
export function sat_i8(v: number): number {
  if (Number.isNaN(v)) return 0;
  const t = Math.trunc(v);
  if (t <= I8_MIN) return I8_MIN;
  if (t >= I8_MAX) return I8_MAX;
  return t;
}

/** Rust `f32 as u8`: truncate toward zero, then saturate to `[0, 255]`. */
export function sat_u8(v: number): number {
  if (Number.isNaN(v)) return 0;
  const t = Math.trunc(v);
  if (t <= U8_MIN) return U8_MIN;
  if (t >= U8_MAX) return U8_MAX;
  return t;
}

/** Rust `i8::saturating_add`. */
export function saturating_add_i8(a: number, b: number): number {
  const sum = a + b;
  return sum < I8_MIN ? I8_MIN : sum > I8_MAX ? I8_MAX : sum;
}

/** Rust `i8::saturating_sub`. */
export function saturating_sub_i8(a: number, b: number): number {
  const diff = a - b;
  return diff < I8_MIN ? I8_MIN : diff > I8_MAX ? I8_MAX : diff;
}

/** Rust `u8::saturating_add`. */
export function saturating_add_u8(a: number, b: number): number {
  const sum = a + b;
  return sum < U8_MIN ? U8_MIN : sum > U8_MAX ? U8_MAX : sum;
}

/** Rust `u8::saturating_sub`. */
export function saturating_sub_u8(a: number, b: number): number {
  const diff = a - b;
  return diff < U8_MIN ? U8_MIN : diff > U8_MAX ? U8_MAX : diff;
}

/** Rust `f32::round`, which rounds half away from zero (unlike `Math.round`). */
export function f32Round(v: number): number {
  return v < 0 ? -Math.round(-v) : Math.round(v);
}