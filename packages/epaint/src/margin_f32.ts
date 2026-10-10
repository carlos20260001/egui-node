/**
 * Port of `epaint/src/margin_f32.rs`.
 */

import { Rect, Vec2, vec2 } from '@egui-node/emath';
import { Margin } from './margin.js';
import { sat_i8 } from './internal.js';

/**
 * A value for all four sides of a rectangle, often used to express padding or
 * spacing.
 *
 * Can be added and subtracted to/from `Rect`s.
 *
 * For storage, use {@link Margin} instead, which is smaller.
 */
export class MarginF32 {
  left: number;
  right: number;
  top: number;
  bottom: number;

  constructor(left: number, right: number, top: number, bottom: number) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
  }

  static readonly ZERO: MarginF32 = new MarginF32(0, 0, 0, 0);

  /** The same margin on every side. */
  static same(margin: number): MarginF32 {
    return new MarginF32(margin, margin, margin, margin);
  }

  /** Margins with the same size on opposing sides. */
  static symmetric(x: number, y: number): MarginF32 {
    return new MarginF32(x, x, y, y);
  }

  /** `impl From<f32> for MarginF32` */
  static from_f32(v: number): MarginF32 {
    return MarginF32.same(v);
  }

  /** `impl From<Vec2> for MarginF32` */
  static fromVec2(v: Vec2): MarginF32 {
    return MarginF32.symmetric(v.x, v.y);
  }

  /** `impl From<Margin> for MarginF32` */
  static fromMargin(margin: Margin): MarginF32 {
    return new MarginF32(margin.left, margin.right, margin.top, margin.bottom);
  }

  /** `impl From<MarginF32> for Margin` (truncating, per Rust's `as` cast). */
  toMargin(): Margin {
    return new Margin(sat_i8(this.left), sat_i8(this.right), sat_i8(this.top), sat_i8(this.bottom));
  }

  /** Total margins on both sides */
  sum(): Vec2 {
    return vec2(this.left + this.right, this.top + this.bottom);
  }

  left_top(): Vec2 {
    return vec2(this.left, this.top);
  }

  right_bottom(): Vec2 {
    return vec2(this.right, this.bottom);
  }

  /** Are the margin on every side the same? */
  is_same(): boolean {
    return this.left === this.right && this.left === this.top && this.left === this.bottom;
  }

  add(other: MarginF32): MarginF32 {
    return new MarginF32(
      this.left + other.left,
      this.right + other.right,
      this.top + other.top,
      this.bottom + other.bottom,
    );
  }

  sub(other: MarginF32): MarginF32 {
    return new MarginF32(
      this.left - other.left,
      this.right - other.right,
      this.top - other.top,
      this.bottom - other.bottom,
    );
  }

  mul(v: number): MarginF32 {
    return new MarginF32(this.left * v, this.right * v, this.top * v, this.bottom * v);
  }

  div(v: number): MarginF32 {
    return new MarginF32(this.left / v, this.right / v, this.top / v, this.bottom / v);
  }

  clone(): MarginF32 {
    return new MarginF32(this.left, this.right, this.top, this.bottom);
  }

  equals(other: MarginF32): boolean {
    return (
      this.left === other.left && this.right === other.right && this.top === other.top && this.bottom === other.bottom
    );
  }

  toString(): string {
    return `MarginF32 { left: ${this.left}, right: ${this.right}, top: ${this.top}, bottom: ${this.bottom} }`;
  }
}

/** `impl Add<MarginF32> for Rect` */
export function rectAddMarginF32(rect: Rect, margin: MarginF32): Rect {
  return Rect.from_min_max(rect.min.sub(margin.left_top()), rect.max.add(margin.right_bottom()));
}

/** `impl Sub<MarginF32> for Rect` */
export function rectSubMarginF32(rect: Rect, margin: MarginF32): Rect {
  return Rect.from_min_max(rect.min.add(margin.left_top()), rect.max.sub(margin.right_bottom()));
}