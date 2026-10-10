/**
 * Port of `ecolor/src/lib.rs`.
 *
 * Color conversions and types. This crate is built for the wants and needs of
 * `egui`.
 *
 * ## Conventions
 * The word "gamma" or "srgb" is used to refer to values in the non-linear
 * space defined by [the sRGB transfer function](https://en.wikipedia.org/wiki/SRGB).
 * We use `u8` for anything in the "gamma" space.
 *
 * We use `f32` in 0-1 range for anything in the linear space.
 *
 * The public conversion functions (`linear_from_gamma`, `gamma_from_linear`,
 * `linear_f32_from_gamma_u8`, ...) live in `rgba.ts` next to `Rgba`, the only
 * type that uses them, and are re-exported from the package root.
 */

import { Color32 } from './color32.js';

export * from './internal.js';
export * from './color32.js';
export * from './rgba.js';
export * from './hsva.js';
export * from './hsva_gamma.js';
export * from './hex_color_runtime.js';

/**
 * Cheap and ugly. Made for graying out disabled `Ui`s.
 */
export function tint_color_towards(color: Color32, target: Color32): Color32 {
  let r = color.r;
  let g = color.g;
  let b = color.b;
  let a = color.a;

  if (a === 0) {
    r = Math.floor(r / 2);
    g = Math.floor(g / 2);
    b = Math.floor(b / 2);
  } else if (a < 170) {
    // Cheapish and looks ok. Works for e.g. grid stripes.
    // Rust: `let div = (2 * 255 / a as i32) as u8;` - integer division, then a
    // saturating cast to u8, so small alphas clamp the divisor to 255.
    const div = Math.min(Math.trunc((2 * 255) / a), 255);
    r = Math.floor(r / 2) + Math.floor(target.r / div);
    g = Math.floor(g / 2) + Math.floor(target.g / div);
    b = Math.floor(b / 2) + Math.floor(target.b / div);
    a = Math.floor(a / 2);
  } else {
    r = Math.floor(r / 2) + Math.floor(target.r / 2);
    g = Math.floor(g / 2) + Math.floor(target.g / 2);
    b = Math.floor(b / 2) + Math.floor(target.b / 2);
  }
  return Color32.from_rgba_premultiplied(r, g, b, a);
}