/**
 * Port of `epaint/src/color.rs`.
 */

import { Pos2, Rect } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';

/** A callback mapping a position within a path's bounding box to a colour. */
export type UvColorFn = (bounding_box: Rect, position: Pos2) => Color32;

/**
 * How paths will be colored.
 *
 * This is a Rust enum with two variants, `Solid(Color32)` and
 * `UV(Arc<dyn Fn(...)>)`. TypeScript has no sum types, so this is a
 * discriminated union; construct one with {@link colorModeSolid} or
 * {@link colorModeUv}.
 */
export type ColorMode = SolidColorMode | UvColorMode;

export interface SolidColorMode {
  readonly kind: 'Solid';
  readonly color: Color32;
}

export interface UvColorMode {
  readonly kind: 'UV';
  readonly callback: UvColorFn;
}

/** The entire path is one solid color. This is the default. */
export function colorModeSolid(color: Color32): SolidColorMode {
  return { kind: 'Solid', color };
}

/**
 * Provide a callback which takes in the path's bounding box and a position and
 * converts it to a color.
 *
 * When used with a path, the bounding box will have a margin of
 * `TessellationOptions::feathering_size_in_pixels`.
 *
 * Rust wraps this in an `Arc` so the callback can be shared cheaply; in
 * TypeScript closures are already reference types.
 */
export function colorModeUv(callback: UvColorFn): UvColorMode {
  return { kind: 'UV', callback };
}

/** `ColorMode::TRANSPARENT`, which is also the `Default`. */
export const TRANSPARENT_COLOR_MODE: SolidColorMode = colorModeSolid(Color32.TRANSPARENT);

/** Evaluate the colour at a position. */
export function colorModeAt(mode: ColorMode, bounding_box: Rect, position: Pos2): Color32 {
  return mode.kind === 'Solid' ? mode.color : mode.callback(bounding_box, position);
}

/**
 * Rust's hand-written `PartialEq`: two `UV` modes are never equal (closures
 * have no meaningful equality), and the variants must match.
 */
export function colorModeEquals(a: ColorMode, b: ColorMode): boolean {
  if (a.kind === 'Solid' && b.kind === 'Solid') {
    return a.color.equals(b.color);
  }
  return false;
}

/** Rust's `Debug for ColorMode`, which prints closures as `"<closure>"`. */
export function colorModeDebug(mode: ColorMode): string {
  return mode.kind === 'Solid' ? `Solid(${mode.color.toString()})` : 'UV("<closure>")';
}