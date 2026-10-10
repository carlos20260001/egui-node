/**
 * Port of `epaint/src/stroke.rs`.
 */

import { Rect } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';
import { TRANSPARENT_COLOR_MODE, colorModeEquals, colorModeSolid, colorModeUv } from './color.js';
import type { ColorMode, UvColorFn } from './color.js';
import { f32Round } from './internal.js';

/** Describes the width and color of a line. */
export class Stroke {
  width: number;
  color: Color32;

  constructor(width: number, color: Color32) {
    this.width = width;
    this.color = color;
  }

  /** Same as `new Stroke(0, Color32.TRANSPARENT)`. */
  static readonly NONE: Stroke = new Stroke(0.0, Color32.TRANSPARENT);

  static new(width: number, color: Color32): Stroke {
    return new Stroke(width, color);
  }

  /** True if width is zero or color is transparent. */
  is_empty(): boolean {
    return this.width <= 0.0 || this.color.equals(Color32.TRANSPARENT);
  }

  /**
   * For vertical or horizontal lines: round the stroke center to produce a
   * sharp, pixel-aligned line.
   */
  round_center_to_pixel(pixels_per_point: number, coord: number): number {
    // If the stroke is an odd number of pixels wide, we want to round the center
    // of it to the center of a pixel.
    //
    // If however it is an even number of pixels wide, we want to round the
    // center to be between two pixels.
    //
    // We also want to treat strokes that are _almost_ odd as if it was odd, to
    // make it symmetric. Same for strokes that are _almost_ even.
    //
    // For strokes less than a pixel wide we also round to the center, because it
    // will be rendered as a single row of pixels by the tessellator.
    const pixel_size = 1.0 / pixels_per_point;

    if (this.width <= pixel_size || is_nearest_integer_odd(pixels_per_point * this.width)) {
      return round_to_pixel_center(coord, pixels_per_point);
    }
    return round_to_pixels(coord, pixels_per_point);
  }

  /** Rounds a rect so that the stroke lands crisply on the pixel grid. */
  round_rect_to_pixel(pixels_per_point: number, rect: Rect): Rect {
    // We put odd-width strokes in the center of pixels.
    // To understand why, see `round_center_to_pixel`.
    const pixel_size = 1.0 / pixels_per_point;

    const width = this.width;
    if (width <= 0.0) {
      return rect.round_to_pixels(pixels_per_point);
    }
    if (width <= pixel_size || is_nearest_integer_odd(pixels_per_point * width)) {
      return rect.round_to_pixel_center(pixels_per_point);
    }
    return rect.round_to_pixels(pixels_per_point);
  }

  clone(): Stroke {
    return new Stroke(this.width, this.color);
  }

  equals(other: Stroke): boolean {
    return this.width === other.width && this.color.equals(other.color);
  }

  toString(): string {
    return `Stroke { width: ${this.width}, color: ${this.color.toString()} }`;
  }
}

/** Returns true if the nearest integer is odd. */
export function is_nearest_integer_odd(x: number): boolean {
  return fract(x * 0.5 + 0.25) > 0.5;
}

function fract(v: number): number {
  return v - Math.floor(v);
}

// The two pixel-rounding helpers are methods on Rect/Pos2 in emath; these thin
// wrappers keep the call sites above readable.
function round_to_pixels(coord: number, pixels_per_point: number): number {
  return f32Round(coord * pixels_per_point) / pixels_per_point;
}

function round_to_pixel_center(coord: number, pixels_per_point: number): number {
  return (f32Round(coord * pixels_per_point - 0.5) + 0.5) / pixels_per_point;
}

/**
 * Describes how the stroke of a shape should be painted.
 *
 * A Rust unit enum, so a string union.
 */
export type StrokeKind = 'Inside' | 'Middle' | 'Outside';

/** Describes the width and color of paths. The color can be solid or provided by a callback. */
export class PathStroke {
  width: number;
  color: ColorMode;
  kind: StrokeKind;

  constructor(width: number, color: ColorMode, kind: StrokeKind = 'Middle') {
    this.width = width;
    this.color = color;
    this.kind = kind;
  }

  /** Same as `new PathStroke(0, TRANSPARENT, 'Middle')`. */
  static readonly NONE: PathStroke = new PathStroke(0.0, TRANSPARENT_COLOR_MODE, 'Middle');

  static new(width: number, color: Color32): PathStroke {
    return new PathStroke(width, colorModeSolid(color), 'Middle');
  }

  /**
   * Create a new `PathStroke` with a UV function.
   *
   * The bounding box passed to the callback will have a margin of
   * `TessellationOptions::feathering_size_in_pixels`.
   */
  static new_uv(width: number, callback: UvColorFn): PathStroke {
    return new PathStroke(width, colorModeUv(callback), 'Middle');
  }

  /** `impl From<Stroke> for PathStroke` */
  static fromStroke(value: Stroke): PathStroke {
    if (value.is_empty()) {
      // Important, since we use the stroke color when doing feathering of the fill!
      return PathStroke.NONE;
    }
    return new PathStroke(value.width, colorModeSolid(value.color), 'Middle');
  }

  with_kind(kind: StrokeKind): PathStroke {
    return new PathStroke(this.width, this.color, kind);
  }

  /** Set the stroke to be painted right on the edge of the shape, half inside and half outside. */
  middle(): PathStroke {
    return this.with_kind('Middle');
  }

  /** Set the stroke to be painted entirely outside of the shape. */
  outside(): PathStroke {
    return this.with_kind('Outside');
  }

  /** Set the stroke to be painted entirely inside of the shape. */
  inside(): PathStroke {
    return this.with_kind('Inside');
  }

  /** True if width is zero or the color is solid and transparent. */
  is_empty(): boolean {
    return this.width <= 0.0 || colorModeEquals(this.color, TRANSPARENT_COLOR_MODE);
  }

  clone(): PathStroke {
    return new PathStroke(this.width, this.color, this.kind);
  }

  equals(other: PathStroke): boolean {
    return this.width === other.width && this.kind === other.kind && colorModeEquals(this.color, other.color);
  }

  toString(): string {
    return `PathStroke { width: ${this.width}, kind: ${this.kind} }`;
  }
}