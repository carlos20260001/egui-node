/**
 * Port of `emath/src/align.rs`.
 *
 * Rust unit enums map to string-literal unions, which also matches how
 * serde serialises them (`"Min"`, `"Center"`, `"Max"`).
 */

import { Pos2, pos2 } from './pos2.js';
import { Rangef } from './range.js';
import { Rect } from './rect.js';
import { Vec2, vec2 } from './vec2.js';
import { fast_midpoint } from './numeric.js';

/** left/center/right or top/center/bottom alignment for e.g. anchors and layouts. */
export type Align = 'Min' | 'Center' | 'Max';

/** Convenience for `Align::Min` (left or top). */
export const AlignMin: Align = 'Min';
/** Horizontal or vertical center. */
export const AlignCenter: Align = 'Center';
/** Convenience for `Align::Max` (right or bottom). */
export const AlignMax: Align = 'Max';

const ALIGN_LEFT: Align = 'Min';
const ALIGN_RIGHT: Align = 'Max';
const ALIGN_TOP: Align = 'Min';
const ALIGN_BOTTOM: Align = 'Max';

/** Convert `Min => 0.0`, `Center => 0.5` or `Max => 1.0`. */
export function align_to_factor(self: Align): number {
  switch (self) {
    case 'Min':
      return 0.0;
    case 'Center':
      return 0.5;
    case 'Max':
      return 1.0;
  }
}

/** Convert `Min => -1.0`, `Center => 0.0` or `Max => 1.0`. */
export function align_to_sign(self: Align): number {
  switch (self) {
    case 'Min':
      return -1.0;
    case 'Center':
      return 0.0;
    case 'Max':
      return 1.0;
  }
}

/**
 * Returns the inverse alignment.
 * `Min` becomes `Max`, `Center` stays the same, `Max` becomes `Min`.
 */
export function align_flipped(self: Align): Align {
  switch (self) {
    case 'Min':
      return 'Max';
    case 'Center':
      return 'Center';
    case 'Max':
      return 'Min';
  }
}

/**
 * Returns a range of given size within a specified range.
 *
 * If the requested `size` is bigger than the size of `range`, then the returned
 * range will not fit into the available `range`. The extra space will be
 * allocated from:
 *
 * | Align  | Side         |
 * |--------|--------------|
 * | Min    | right (end)  |
 * | Center | both         |
 * | Max    | left (start) |
 *
 * ```
 * // The size is smaller than a range
 * align_size_within_range('Min',    2.0, 10..=20) === 10..=12
 * align_size_within_range('Center', 2.0, 10..=20) === 14..=16
 * align_size_within_range('Max',    2.0, 10..=20) === 18..=20
 *
 * // The size is bigger than a range
 * align_size_within_range('Min',    20.0, 10..=20) === 10..=30
 * align_size_within_range('Center', 20.0, 10..=20) ===  5..=25
 * align_size_within_range('Max',    20.0, 10..=20) ===  0..=20
 * ```
 *
 * The infinity-sized ranges can produce surprising results if the size is also
 * infinity; use such ranges carefully.
 */
export function align_size_within_range(self: Align, size: number, range: Rangef): Rangef {
  const { min, max } = range;

  if (max - min === Number.POSITIVE_INFINITY && size === Number.POSITIVE_INFINITY) {
    return range;
  }

  switch (self) {
    case 'Min':
      return new Rangef(min, min + size);
    case 'Center': {
      if (size === Number.POSITIVE_INFINITY) {
        return new Rangef(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY);
      }
      const left = fast_midpoint(min, max) - size * 0.5;
      return new Rangef(left, left + size);
    }
    case 'Max':
      return new Rangef(max - size, max);
  }
}

/** Two-dimensional alignment, e.g. `Align2.LEFT_TOP`. */
export class Align2 {
  [0]: Align;
  [1]: Align;

  constructor(x: Align, y: Align) {
    this[0] = x;
    this[1] = y;
  }

  static readonly LEFT_BOTTOM: Align2 = new Align2('Min', 'Max');
  static readonly LEFT_CENTER: Align2 = new Align2('Min', 'Center');
  static readonly LEFT_TOP: Align2 = new Align2('Min', 'Min');
  static readonly CENTER_BOTTOM: Align2 = new Align2('Center', 'Max');
  static readonly CENTER_CENTER: Align2 = new Align2('Center', 'Center');
  static readonly CENTER_TOP: Align2 = new Align2('Center', 'Min');
  static readonly RIGHT_BOTTOM: Align2 = new Align2('Max', 'Max');
  static readonly RIGHT_CENTER: Align2 = new Align2('Max', 'Center');
  static readonly RIGHT_TOP: Align2 = new Align2('Max', 'Min');

  static new(x: Align, y: Align): Align2 {
    return new Align2(x, y);
  }

  /**
   * Set align on the horizontal axis.
   *
   * NOTE: Rust's `Align2` is `Copy`, so `with_x` there mutates a private copy.
   * Here it must return a new instance, otherwise it would corrupt the shared
   * `Align2.LEFT_TOP`-style constants.
   */
  with_x(x: Align): Align2 {
    return new Align2(x, this[1]);
  }

  /**
   * Set align on the vertical axis.
   *
   * See the note on {@link Align2.with_x} about copying.
   */
  with_y(y: Align): Align2 {
    return new Align2(this[0], y);
  }

  /** Set align on the horizontal axis. */
  set_x(x: Align): void {
    this[0] = x;
  }

  /** Set align on the vertical axis. */
  set_y(y: Align): void {
    this[1] = y;
  }

  /** Returns an alignment by the X (horizontal) axis */
  x(): Align {
    return this[0];
  }

  /** Returns an alignment by the Y (vertical) axis */
  y(): Align {
    return this[1];
  }

  /** -1, 0, or +1 for each axis */
  to_sign(): Vec2 {
    return vec2(align_to_sign(this.x()), align_to_sign(this.y()));
  }

  /** Flip on the x-axis, e.g. `TOP_LEFT` -> `TOP_RIGHT` */
  flipped_x(): Align2 {
    return this.with_x(align_flipped(this.x()));
  }

  /** Flip on the y-axis, e.g. `TOP_LEFT` -> `BOTTOM_LEFT` */
  flipped_y(): Align2 {
    return this.with_y(align_flipped(this.y()));
  }

  /** Flip on both axes, e.g. `TOP_LEFT` -> `BOTTOM_RIGHT` */
  flipped(): Align2 {
    return new Align2(align_flipped(this.x()), align_flipped(this.y()));
  }

  /**
   * Used e.g. to anchor a piece of text to a part of the rectangle.
   * Gives a position within the rect, specified by the aligns.
   */
  anchor_rect(rect: Rect): Rect {
    let x: number;
    switch (this.x()) {
      case 'Min':
        x = rect.left();
        break;
      case 'Center':
        x = rect.left() - 0.5 * rect.width();
        break;
      case 'Max':
        x = rect.left() - rect.width();
        break;
    }
    let y: number;
    switch (this.y()) {
      case 'Min':
        y = rect.top();
        break;
      case 'Center':
        y = rect.top() - 0.5 * rect.height();
        break;
      case 'Max':
        y = rect.top() - rect.height();
        break;
    }
    return Rect.from_min_size(pos2(x, y), rect.size());
  }

  /**
   * Use this anchor to position something around `pos`,
   * e.g. `RIGHT_TOP` means the right-top of the rect will end up at `pos`.
   */
  anchor_size(pos: Pos2, size: Vec2): Rect {
    let x: number;
    switch (this.x()) {
      case 'Min':
        x = pos.x;
        break;
      case 'Center':
        x = pos.x - 0.5 * size.x;
        break;
      case 'Max':
        x = pos.x - size.x;
        break;
    }
    let y: number;
    switch (this.y()) {
      case 'Min':
        y = pos.y;
        break;
      case 'Center':
        y = pos.y - 0.5 * size.y;
        break;
      case 'Max':
        y = pos.y - size.y;
        break;
    }
    return Rect.from_min_size(pos2(x, y), size);
  }

  /** e.g. center a size within a given frame */
  align_size_within_rect(size: Vec2, frame: Rect): Rect {
    const x_range = align_size_within_range(this.x(), size.x, frame.x_range());
    const y_range = align_size_within_range(this.y(), size.y, frame.y_range());
    return Rect.from_x_y_ranges(x_range, y_range);
  }

  /**
   * Returns the point on the rect's frame or in the center of a rect according
   * to the alignments of this object.
   *
   * ```text
   * (*)-----------+------(*)------+-----------(*)--> X
   *  |            |               |            |
   *  |  Min, Min  |  Center, Min  |  Max, Min  |
   *  |            |               |            |
   *  +------------+---------------+------------+
   *  |            |               |            |
   * (*)Min, Center|Center(*)Center|Max, Center(*)
   *  |            |               |            |
   *  +------------+---------------+------------+
   *  |            |               |            |
   *  |  Min, Max  | Center, Max   |  Max, Max  |
   *  |            |               |            |
   * (*)-----------+------(*)------+-----------(*)
   *  |
   *  Y
   * ```
   */
  pos_in_rect(frame: Rect): Pos2 {
    let x: number;
    switch (this.x()) {
      case 'Min':
        x = frame.left();
        break;
      case 'Center':
        x = frame.center().x;
        break;
      case 'Max':
        x = frame.right();
        break;
    }
    let y: number;
    switch (this.y()) {
      case 'Min':
        y = frame.top();
        break;
      case 'Center':
        y = frame.center().y;
        break;
      case 'Max':
        y = frame.bottom();
        break;
    }
    return pos2(x, y);
  }

  /** `core::ops::Index<usize> for Align2` */
  get(index: number): Align {
    switch (index) {
      case 0:
        return this[0];
      case 1:
        return this[1];
      default:
        throw new RangeError(`Align2 index out of bounds: ${index}`);
    }
  }

  clone(): Align2 {
    return new Align2(this[0], this[1]);
  }

  equals(other: Align2): boolean {
    return this[0] === other[0] && this[1] === other[1];
  }

  toDebug(): string {
    return `Align2(${this.x()}, ${this.y()})`;
  }

  toString(): string {
    return this.toDebug();
  }
}

/**
 * Allocates a rectangle of the specified `size` inside the `frame` rectangle
 * around of its center.
 *
 * If `size` is bigger than the `frame`s size the returned rect will bounce out
 * of the `frame`.
 */
export function center_size_in_rect(size: Vec2, frame: Rect): Rect {
  return Align2.CENTER_CENTER.align_size_within_rect(size, frame);
}

/** Named aliases mirroring the Rust constants. */
export const Align = {
  LEFT: ALIGN_LEFT,
  RIGHT: ALIGN_RIGHT,
  TOP: ALIGN_TOP,
  BOTTOM: ALIGN_BOTTOM,
  Min: AlignMin,
  Center: AlignCenter,
  Max: AlignMax,
} as const;