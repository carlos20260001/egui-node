/**
 * Port of `emath/src/vec2b.rs`.
 */

import { Vec2 } from './vec2.js';

/** Two bools, one for each axis (X and Y). */
export class Vec2b {
  x: boolean;
  y: boolean;

  constructor(x: boolean, y: boolean) {
    this.x = x;
    this.y = y;
  }

  static readonly FALSE: Vec2b = new Vec2b(false, false);
  static readonly TRUE: Vec2b = new Vec2b(true, true);

  static new(x: boolean, y: boolean): Vec2b {
    return new Vec2b(x, y);
  }

  /** `impl From<bool> for Vec2b` */
  static fromBool(val: boolean): Vec2b {
    return new Vec2b(val, val);
  }

  /** `impl From<[bool; 2]> for Vec2b` */
  static fromArray(v: readonly [boolean, boolean]): Vec2b {
    return new Vec2b(v[0], v[1]);
  }

  any(): boolean {
    return this.x || this.y;
  }

  /** Are both `x` and `y` true? */
  all(): boolean {
    return this.x && this.y;
  }

  and(other: Vec2b): Vec2b {
    return new Vec2b(this.x && other.x, this.y && other.y);
  }

  or(other: Vec2b): Vec2b {
    return new Vec2b(this.x || other.x, this.y || other.y);
  }

  /** `!self` (`impl core::ops::Not for Vec2b`). */
  not(): Vec2b {
    return new Vec2b(!this.x, !this.y);
  }

  /**
   * Convert to a float `Vec2` where the components are 1.0 for `true` and
   * 0.0 for `false`.
   */
  to_vec2(): Vec2 {
    return new Vec2(this.x ? 1 : 0, this.y ? 1 : 0);
  }

  /** `v[0]` / `v[1]`. Throws if `index > 1`, matching the Rust panic. */
  get(index: number): boolean {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw new RangeError(`Vec2b index out of bounds: ${index}`);
    }
  }

  /** `v[index] = value`. Throws if `index > 1`, matching the Rust panic. */
  set(index: number, value: boolean): void {
    switch (index) {
      case 0:
        this.x = value;
        return;
      case 1:
        this.y = value;
        return;
      default:
        throw new RangeError(`Vec2b index out of bounds: ${index}`);
    }
  }

  clone(): Vec2b {
    return new Vec2b(this.x, this.y);
  }

  equals(other: Vec2b): boolean {
    return this.x === other.x && this.y === other.y;
  }

  toString(): string {
    return `[${this.x} ${this.y}]`;
  }
}