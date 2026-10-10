/**
 * Port of `epaint/src/direction.rs`.
 */

/** The direction of a gradient. A Rust unit enum, so a string union. */
export type Direction = 'LeftToRight' | 'RightToLeft' | 'TopDown' | 'BottomUp';

export function directionIsHorizontal(self: Direction): boolean {
  return self === 'LeftToRight' || self === 'RightToLeft';
}

export function directionIsVertical(self: Direction): boolean {
  return self === 'TopDown' || self === 'BottomUp';
}