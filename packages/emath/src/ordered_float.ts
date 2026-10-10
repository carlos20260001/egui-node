/**
 * Port of `emath/src/ordered_float.rs`.
 *
 * Rust needs a total order on floats so that they can be used as sort keys.
 * JavaScript's `<` and `>` already give a total order (every value compares
 * consistently), so instead of wrapping floats in an `OrderedFloat` newtype we
 * expose the comparator directly.
 *
 * Semantics copied from Rust:
 * * All NaNs compare equal to each other, and sort *after* every other value
 *   (`OrderedFloat::cmp` falls back to `is_nan().cmp(&is_nan())`).
 * * The sign of zero is ignored (`-0.0 == 0.0`), matching `PartialOrd`.
 */

/**
 * A three-way comparison, mirroring `core::cmp::Ordering`.
 * Returns -1 for `Less`, 0 for `Equal`, +1 for `Greater`.
 */
export type Ordering = -1 | 0 | 1;

/**
 * Total order over floats, for use as a sort key.
 *
 * Compare with {@link cmp_ordered_float}, or pass to `Array.prototype.sort`.
 *
 * ```
 * [1.0, 2.5, 2.0].sort(cmp_ordered_float)  // [1.0, 2.0, 2.5]
 * ```
 */
export function cmp_ordered_float(a: number, b: number): number {
  const a_nan = Number.isNaN(a);
  const b_nan = Number.isNaN(b);

  if (a_nan || b_nan) {
    // `false.cmp(&true)`: non-NaN sorts before NaN.
    if (a_nan && b_nan) return 0;
    return a_nan ? 1 : -1;
  }

  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** `OrderedFloat::into_inner` */
export function into_inner(v: number): number {
  return v;
}

/**
 * Sort a copy of `values` into total order, as
 * `Float::ord().cmp()` would in Rust.
 */
export function sort_ordered<T extends number>(values: readonly T[]): T[] {
  return [...values].sort(cmp_ordered_float);
}

/** `sort_ordered`, but sorts in place. */
export function sort_ordered_in_place<T extends number>(values: T[]): T[] {
  return values.sort(cmp_ordered_float);
}