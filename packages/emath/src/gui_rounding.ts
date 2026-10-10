/**
 * Port of `emath/src/gui_rounding.rs`.
 *
 * Rust attaches these through the `GuiRounding` trait, which cannot be
 * implemented from outside the crate. Here the scalar operations live in this
 * module, and `Vec2`/`Pos2`/`Rect` implement the same four names as methods,
 * so call sites read exactly like the Rust source.
 */

import { f32Round } from './f32util.js';

/**
 * We (sometimes) round sizes and coordinates to an even multiple of this value.
 *
 * This is only used for rounding _logical UI points_, used for widget
 * coordinates and sizes. When rendering, you may want to round to an integer
 * multiple of the physical _pixels_ instead, using `round_to_pixels`.
 *
 * This constant has to be a (negative) power of two so that it can be
 * represented exactly by a floating point number.
 *
 * If we pick too large a value (e.g. 1 or 1/2), then we get judder during
 * scrolling and animations. If we pick too small a value (e.g. 1/4096), we run
 * the risk of rounding errors again.
 */
export const GUI_ROUNDING: number = 1.0 / 32.0;

/**
 * Rounds floating point numbers to an even multiple of the GUI rounding
 * factor, {@link GUI_ROUNDING}.
 *
 * Use this for widget coordinates and sizes.
 *
 * Rounding sizes and positions prevent rounding errors when doing sizing
 * calculations. We don't round to integers, because that would be too coarse
 * (causing visible juddering when scrolling, for instance).
 */
export function round_ui(self: number): number {
  return f32Round(self / GUI_ROUNDING) * GUI_ROUNDING;
}

/** Like {@link round_ui}, but always rounds towards negative infinity. */
export function floor_ui(self: number): number {
  return Math.floor(self / GUI_ROUNDING) * GUI_ROUNDING;
}

/**
 * Round a size or position to an even multiple of the physical pixel size.
 *
 * This can be useful for crisp rendering.
 *
 * The `self` should be in coordinates of _logical UI points_. The argument
 * `pixels_per_point` is the number of _physical pixels_ per logical UI point.
 * For instance, on a high-DPI screen, `pixels_per_point` could be `2.0`.
 */
export function round_to_pixels(self: number, pixels_per_point: number): number {
  return f32Round(self * pixels_per_point) / pixels_per_point;
}

/**
 * Will round the position to be in the center of a pixel.
 *
 * The pixel size is `1.0 / pixels_per_point`.
 *
 * So if `pixels_per_point = 2` (i.e. `pixel size = 0.5`), then the position
 * will be rounded to the closest of `…, 0.25, 0.75, 1.25, …`.
 *
 * This is useful, for instance, when picking the center of a line that is one
 * pixel wide.
 */
export function round_to_pixel_center(self: number, pixels_per_point: number): number {
  return (f32Round(self * pixels_per_point - 0.5) + 0.5) / pixels_per_point;
}