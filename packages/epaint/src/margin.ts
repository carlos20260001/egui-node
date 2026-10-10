/**
 * Port of `epaint/src/margin.rs`.
 */

import { Rect, Vec2, vec2 } from '@egui-node/emath';
import { f32Round, sat_i8, saturating_add_i8, saturating_sub_i8 } from './internal.js';

/**
 * A value for all four sides of a rectangle, often used to express padding or
 * spacing.
 *
 * Can be added and subtracted to/from `Rect`s.
 *
 * Negative margins are possible, but may produce weird behavior. Use with care.
 *
 * All values are stored as `i8` to keep the size of `Margin` small. If you want
 * floats, use {@link MarginF32} instead.
 *
 * Each field is a plain number constrained to `[-128, 127]`, mirroring Rust's
 * `i8`.
 */
export class Margin {
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

  static readonly ZERO: Margin = new Margin(0, 0, 0, 0);

  /** The same margin on every side. */
  static same(margin: number): Margin {
    return new Margin(margin, margin, margin, margin);
  }

  /** Margins with the same size on opposing sides. */
  static symmetric(x: number, y: number): Margin {
    return new Margin(x, x, y, y);
  }

  /** `impl From<i8> for Margin` */
  static fromI8(v: number): Margin {
    return Margin.same(v);
  }

  /** `impl From<f32> for Margin` */
  static from_f32(v: number): Margin {
    return Margin.same(sat_i8(f32Round(v)));
  }

  /** `impl From<Vec2> for Margin` */
  static fromVec2(v: Vec2): Margin {
    return Margin.symmetric(sat_i8(f32Round(v.x)), sat_i8(f32Round(v.y)));
  }

  /** Left margin, as `f32` */
  leftf(): number {
    return this.left;
  }

  /** Right margin, as `f32` */
  rightf(): number {
    return this.right;
  }

  /** Top margin, as `f32` */
  topf(): number {
    return this.top;
  }

  /** Bottom margin, as `f32` */
  bottomf(): number {
    return this.bottom;
  }

  /** Total margins on both sides */
  sum(): Vec2 {
    return vec2(this.leftf() + this.rightf(), this.topf() + this.bottomf());
  }

  left_top(): Vec2 {
    return vec2(this.leftf(), this.topf());
  }

  right_bottom(): Vec2 {
    return vec2(this.rightf(), this.bottomf());
  }

  /** Are the margin on every side the same? */
  is_same(): boolean {
    return this.left === this.right && this.left === this.top && this.left === this.bottom;
  }

  /** `self + other` */
  add(other: Margin): Margin;
  /** `self + v` */
  add(v: number): Margin;
  add(other: Margin | number): Margin {
    if (typeof other === 'number') {
      return new Margin(
        saturating_add_i8(this.left, other),
        saturating_add_i8(this.right, other),
        saturating_add_i8(this.top, other),
        saturating_add_i8(this.bottom, other),
      );
    }
    return new Margin(
      saturating_add_i8(this.left, other.left),
      saturating_add_i8(this.right, other.right),
      saturating_add_i8(this.top, other.top),
      saturating_add_i8(this.bottom, other.bottom),
    );
  }

  /** `self += v` */
  add_assign(v: number): Margin {
    this.left = saturating_add_i8(this.left, v);
    this.right = saturating_add_i8(this.right, v);
    this.top = saturating_add_i8(this.top, v);
    this.bottom = saturating_add_i8(this.bottom, v);
    return this;
  }

  /** `self * v` */
  mul(v: number): Margin {
    return new Margin(
      sat_i8(f32Round(this.leftf() * v)),
      sat_i8(f32Round(this.rightf() * v)),
      sat_i8(f32Round(this.topf() * v)),
      sat_i8(f32Round(this.bottomf() * v)),
    );
  }

  /** `self *= v` */
  mul_assign(v: number): Margin {
    const m = this.mul(v);
    this.left = m.left;
    this.right = m.right;
    this.top = m.top;
    this.bottom = m.bottom;
    return this;
  }

  /** `self / v`, implemented in Rust as `self * v.recip()`. */
  div(v: number): Margin {
    return this.mul(1 / v);
  }

  /** `self /= v` */
  div_assign(v: number): Margin {
    const m = this.div(v);
    this.left = m.left;
    this.right = m.right;
    this.top = m.top;
    this.bottom = m.bottom;
    return this;
  }

  /** `self - other` */
  sub(other: Margin): Margin;
  /** `self - v` */
  sub(v: number): Margin;
  sub(other: Margin | number): Margin {
    if (typeof other === 'number') {
      return new Margin(
        saturating_sub_i8(this.left, other),
        saturating_sub_i8(this.right, other),
        saturating_sub_i8(this.top, other),
        saturating_sub_i8(this.bottom, other),
      );
    }
    return new Margin(
      saturating_sub_i8(this.left, other.left),
      saturating_sub_i8(this.right, other.right),
      saturating_sub_i8(this.top, other.top),
      saturating_sub_i8(this.bottom, other.bottom),
    );
  }

  /** `self -= v` */
  sub_assign(v: number): Margin {
    this.left = saturating_sub_i8(this.left, v);
    this.right = saturating_sub_i8(this.right, v);
    this.top = saturating_sub_i8(this.top, v);
    this.bottom = saturating_sub_i8(this.bottom, v);
    return this;
  }

  clone(): Margin {
    return new Margin(this.left, this.right, this.top, this.bottom);
  }

  equals(other: Margin): boolean {
    return (
      this.left === other.left && this.right === other.right && this.top === other.top && this.bottom === other.bottom
    );
  }

  toString(): string {
    return `Margin { left: ${this.left}, right: ${this.right}, top: ${this.top}, bottom: ${this.bottom} }`;
  }
}

/**
 * `impl Add<Margin> for Rect`: grow the rect outwards by the margin.
 *
 * Rust implements this on `Rect`; here it is a free function so that `emath`
 * does not have to know about `Margin`.
 */
export function rectAddMargin(rect: Rect, margin: Margin): Rect {
  return Rect.from_min_max(rect.min.sub(margin.left_top()), rect.max.add(margin.right_bottom()));
}

/** `impl Sub<Margin> for Rect`: shrink the rect inwards by the margin. */
export function rectSubMargin(rect: Rect, margin: Margin): Rect {
  return Rect.from_min_max(rect.min.add(margin.left_top()), rect.max.sub(margin.right_bottom()));
}