/**
 * The private numeric helpers from `ecolor/src/lib.rs`.
 *
 * These are `const fn`s that are not `pub` in Rust, so they get their own
 * module here rather than living in `lib.ts` where they would be re-exported.
 *
 * They exist because JavaScript has no equivalent of Rust's integer types, and
 * in particular no equivalent of the `as u8` cast, which **truncates toward
 * zero and saturates** to the target range. `| 0` and `Math.trunc` truncate but
 * do not saturate, and silently produce negative or `> 255` values that then
 * corrupt every downstream colour computation.
 */

/** The inclusive range of a `u8`. */
export const U8_MIN = 0;
export const U8_MAX = 255;

/**
 * Rust `f32 as u8`: truncate toward zero, then saturate into `[0, 255]`.
 * NaN casts to `0` (Rust has done this since 1.45).
 */
export function sat_u8(v: number): number {
  if (Number.isNaN(v)) return 0;
  const t = Math.trunc(v);
  if (t <= U8_MIN) return U8_MIN;
  if (t >= U8_MAX) return U8_MAX;
  return t;
}

/** Rust `i32 as u8`: truncate toward zero, then saturate into `[0, 255]`. */
export function sat_i32_u8(v: number): number {
  return sat_u8(v);
}

/**
 * `const fn fast_round(r: f32) -> u8 { (r + 0.5) as _ }`
 *
 * Round-half-up, then saturate, exactly as Rust's float-to-int `as` cast does.
 */
export function fast_round(r: number): number {
  return sat_u8(r + 0.5);
}

/** Rust `u8::saturating_add`. */
export function saturating_add_u8(a: number, b: number): number {
  const sum = a + b;
  return sum <= U8_MIN ? U8_MIN : sum >= U8_MAX ? U8_MAX : sum;
}

/**
 * `const fn mul_frac_round(val: u8, frac: u8) -> u8`
 *
 * Compute `val * (frac/255)` with no floating point and no divisions.
 * Treats this as a simple fixed point calculation.
 */
export function mul_frac_round(val: number, frac: number): number {
  const p = val * frac + 128;
  return ((p + (p >> 8)) >> 8) & 0xff;
}

/** Rust `f32::clamp` over `[0, 255]`, returning a `u8`. */
export function clamp_u8(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.trunc(v);
}