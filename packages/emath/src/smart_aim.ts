/**
 * Port of `emath/src/smart_aim.rs`.
 *
 * Find "simple" numbers in some range. Used by sliders.
 *
 * This is genuinely `f64` in Rust, not `f32`, and it depends on exact decimal
 * digit behaviour, so it is ported against `f64` semantics. JS numbers are
 * `f64`, so this maps over cleanly.
 */

import { fast_midpoint } from './numeric.js';

const NUM_DECIMALS = 16;

/**
 * Find the "simplest" number in a closed range [min, max], i.e. the one with
 * the fewest decimal digits.
 *
 * So in the range `[0.83, 1.354]` you will get `1.0`, and for `[0.37, 0.48]`
 * you will get `0.4`. This is used when dragging sliders etc to get the values
 * that users are most likely to desire. This assumes a decimal centric user.
 */
export function best_in_range_f64(min: number, max: number): number {
  // Avoid NaN if we can:
  if (Number.isNaN(min)) {
    return max;
  }
  if (Number.isNaN(max)) {
    return min;
  }

  if (max < min) {
    return best_in_range_f64(max, min);
  }
  if (min === max) {
    return min;
  }
  if (min <= 0.0 && 0.0 <= max) {
    return 0.0; // always prefer zero
  }
  if (min < 0.0) {
    return -best_in_range_f64(-max, -min);
  }

  if (!(0.0 < min && min < max)) {
    throw new Error('smart_aim: logic bug, expected 0 < min < max');
  }

  // Prefer finite numbers:
  if (!Number.isFinite(max)) {
    return min;
  }

  const min_exponent = Math.log10(min);
  const max_exponent = Math.log10(max);

  if (Math.floor(min_exponent) !== Math.floor(max_exponent)) {
    // Different orders of magnitude.
    // Pick the geometric center of the two:
    const exponent = fast_midpoint(min_exponent, max_exponent);
    return Math.pow(10, Math.round(exponent));
  }

  if (is_integer(min_exponent)) {
    return Math.pow(10, min_exponent);
  }
  if (is_integer(max_exponent)) {
    return Math.pow(10, max_exponent);
  }

  // Find the proper scale, and then convert to integers:

  const scale = NUM_DECIMALS - Math.floor(max_exponent) - 1;
  const scale_factor = Math.pow(10, scale);

  const min_str = to_decimal_string(BigInt(Math.round(min * scale_factor)));
  const max_str = to_decimal_string(BigInt(Math.round(max * scale_factor)));

  // We now have two positive integers of the same length.
  // We want to find the first non-matching digit,
  // which we will call the "deciding digit".
  // Everything before it will be the same,
  // everything after will be zero,
  // and the deciding digit itself will be picked as a "smart average"
  // min:    12345
  // max:    12780
  // output: 12500

  const ret_str = new Uint8Array(NUM_DECIMALS);

  for (let i = 0; i < NUM_DECIMALS; i++) {
    if (min_str[i] === max_str[i]) {
      ret_str[i] = min_str[i]!;
    } else {
      // Found the deciding digit at index `i`
      let deciding_digit_min = min_str[i]!;
      const deciding_digit_max = max_str[i]!;

      if (!(deciding_digit_min < deciding_digit_max)) {
        throw new Error('smart_aim: bug in smart aim code');
      }

      const rest_of_min_is_zeroes = min_str.subarray(i + 1).every((c) => c === 0);

      if (!rest_of_min_is_zeroes) {
        // There are more digits coming after `deciding_digit_min`, so we cannot
        // pick it. So the true min of what we can pick is one greater:
        deciding_digit_min += 1;
      }

      const deciding_digit =
        deciding_digit_min === 0
          ? 0
          : deciding_digit_min <= 5 && 5 <= deciding_digit_max
            ? 5 // 5 is the roundest number in the range
            : Math.floor(fast_midpoint(deciding_digit_min, deciding_digit_max));

      ret_str[i] = deciding_digit;

      return Number(from_decimal_string(ret_str)) / scale_factor;
    }
  }

  // All digits are the same. Already handled earlier, but better safe than sorry.
  return min;
}

function is_integer(f: number): boolean {
  return Math.round(f) === f;
}

/** The last `NUM_DECIMALS` decimal digits of `v`, most significant first. */
function to_decimal_string(v: bigint): Uint8Array {
  const ret = new Uint8Array(NUM_DECIMALS);
  let value = v;
  const TEN = 10n;
  for (let i = NUM_DECIMALS - 1; i >= 0; i--) {
    ret[i] = Number(value % TEN);
    value = value / TEN;
  }
  return ret;
}

function from_decimal_string(s: Uint8Array): bigint {
  let value = 0n;
  for (const c of s) {
    if (c > 9) {
      throw new Error('smart_aim: bad number');
    }
    value = value * 10n + BigInt(c);
  }
  return value;
}