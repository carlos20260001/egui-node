/**
 * Port of `epaint/src/viewport.rs` and the shared parts of
 * `epaint/src/shapes/paint_callback.rs`.
 */

import { Rect } from '@egui-node/emath';
import { f32Clamp, f32Round } from '@egui-node/emath';

/** A viewport, in physical pixels, ready to hand to a graphics API. */
export class ViewportInPixels {
  /** Physical pixel offset for the left side of the viewport. */
  left_px: number;
  /** Physical pixel offset for the top side of the viewport. */
  top_px: number;
  /** Physical pixel offset for the bottom side, which is what `glViewport` expects for y. */
  from_bottom_px: number;
  /** Viewport width in physical pixels. */
  width_px: number;
  /** Viewport height in physical pixels. */
  height_px: number;

  constructor(left_px: number, top_px: number, from_bottom_px: number, width_px: number, height_px: number) {
    this.left_px = left_px;
    this.top_px = top_px;
    this.from_bottom_px = from_bottom_px;
    this.width_px = width_px;
    this.height_px = height_px;
  }

  static from_points(rect: Rect, pixels_per_point: number, screen_size_px: readonly [number, number]): ViewportInPixels {
    // Fractional pixel values for viewports are generally valid, but may cause
    // sampling issues and rounding errors might cause us to get out of bounds.

    // Round:
    const raw_left = Math.trunc(f32Round(pixels_per_point * rect.min.x)); // inclusive
    const raw_top = Math.trunc(f32Round(pixels_per_point * rect.min.y)); // inclusive
    const raw_right = Math.trunc(f32Round(pixels_per_point * rect.max.x)); // exclusive
    const raw_bottom = Math.trunc(f32Round(pixels_per_point * rect.max.y)); // exclusive

    // Clamp to screen:
    const screen_width = screen_size_px[0];
    const screen_height = screen_size_px[1];
    const left_px = f32Clamp(raw_left, 0, screen_width);
    const right_px = f32Clamp(raw_right, left_px, screen_width);
    const top_px = f32Clamp(raw_top, 0, screen_height);
    const bottom_px = f32Clamp(raw_bottom, top_px, screen_height);

    const width_px = right_px - left_px;
    const height_px = bottom_px - top_px;

    return new ViewportInPixels(left_px, top_px, screen_height - height_px - top_px, width_px, height_px);
  }

  equals(other: ViewportInPixels): boolean {
    return (
      this.left_px === other.left_px &&
      this.top_px === other.top_px &&
      this.from_bottom_px === other.from_bottom_px &&
      this.width_px === other.width_px &&
      this.height_px === other.height_px
    );
  }
}

/** Information passed along with {@link PaintCallback}. */
export class PaintCallbackInfo {
  /** Viewport in points. */
  viewport: Rect;

  /** Clip rectangle in points. */
  clip_rect: Rect;

  /** Pixels per point. */
  pixels_per_point: number;

  /** Full size of the screen, in pixels. */
  screen_size_px: [number, number];

  constructor(viewport: Rect, clip_rect: Rect, pixels_per_point: number, screen_size_px: [number, number]) {
    this.viewport = viewport;
    this.clip_rect = clip_rect;
    this.pixels_per_point = pixels_per_point;
    this.screen_size_px = screen_size_px;
  }

  /** The viewport rectangle, e.g. for `glViewport`. */
  viewport_in_pixels(): ViewportInPixels {
    return ViewportInPixels.from_points(this.viewport, this.pixels_per_point, this.screen_size_px);
  }

  /** The "scissor" or "clip" rectangle, e.g. for `glScissor`. */
  clip_rect_in_pixels(): ViewportInPixels {
    return ViewportInPixels.from_points(this.clip_rect, this.pixels_per_point, this.screen_size_px);
  }
}

/**
 * If you want to paint some 3D shapes inside an egui region, you can use this.
 *
 * This is advanced usage, and is backend specific.
 *
 * `callback` is opaque to `epaint`: Rust stores an `Arc<dyn Any + Send + Sync>`
 * that the backend downcasts to whatever it expects. Here it is `unknown`, and
 * the renderer decides what to do with it.
 */
export class PaintCallback {
  /** Where to paint. This becomes `PaintCallbackInfo::viewport`. */
  rect: Rect;

  /** Paint something custom (e.g. 3D stuff). The concrete value depends on the backend. */
  callback: unknown;

  constructor(rect: Rect, callback: unknown) {
    this.rect = rect;
    this.callback = callback;
  }

  /**
   * Rust compares with `Arc::ptr_eq`, i.e. pointer identity of the callback.
   * Object identity (`===`) is the closest equivalent.
   */
  equals(other: PaintCallback): boolean {
    return this.rect.equals(other.rect) && this.callback === other.callback;
  }

  toString(): string {
    return `PaintCallback { rect: ${this.rect} }`;
  }
}