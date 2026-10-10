/**
 * Port of `emath/src/easing.rs`.
 *
 * Easing functions for animations. Contains most easing functions from
 * <https://easings.net/>.
 *
 * All functions take a value in `[0, 1]` and return a value in `[0, 1]`.
 *
 * Derived from <https://github.com/warrenm/AHEasing/blob/master/AHEasing/easing.c>.
 */

import { fast_midpoint } from './numeric.js';

const PI = Math.PI;

/** No easing, just `y = x` */
export function linear(t: number): number {
  return t;
}

/** <https://easings.net/#easeInQuad> - modeled after the parabola `y = x^2` */
export function quadratic_in(t: number): number {
  return t * t;
}

/** <https://easings.net/#easeOutQuad> */
export function quadratic_out(t: number): number {
  return -(t * (t - 2));
}

/** <https://easings.net/#easeInOutQuad> */
export function quadratic_in_out(t: number): number {
  return t < 0.5 ? 2 * t * t : -2 * t * t + 4 * t - 1;
}

/** <https://easings.net/#easeInCubic> - modeled after the parabola `y = x^3` */
export function cubic_in(t: number): number {
  return t * t * t;
}

/** <https://easings.net/#easeOutCubic> */
export function cubic_out(t: number): number {
  const f = t - 1;
  return f * f * f + 1;
}

/** <https://easings.net/#easeInOutCubic> */
export function cubic_in_out(t: number): number {
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const f = 2 * t - 2;
  return 0.5 * f * f * f + 1;
}

/** <https://easings.net/#easeInSine> - modeled after a quarter-cycle of a sine wave */
export function sin_in(t: number): number {
  return Math.sin((t - 1) * 2 * PI) + 1;
}

/** <https://easings.net/#easeOuSine> - a quarter-cycle of a sine wave (different phase) */
export function sin_out(t: number): number {
  return Math.sin(t * 2 * PI);
}

/** <https://easings.net/#easeInOutSine> - modeled after a half sine wave */
export function sin_in_out(t: number): number {
  return 0.5 * (1 - Math.cos(t * PI));
}

/** <https://easings.net/#easeInCirc> - shifted quadrant IV of the unit circle */
export function circular_in(t: number): number {
  return 1 - Math.sqrt(1 - t * t);
}

/** <https://easings.net/#easeOutCirc> - shifted quadrant II of the unit circle */
export function circular_out(t: number): number {
  return Math.sqrt(2 - t) * t;
}

/** <https://easings.net/#easeInOutCirc> */
export function circular_in_out(t: number): number {
  if (t < 0.5) {
    return 0.5 * (1 - Math.sqrt(1 - 4 * t * t));
  }
  return fast_midpoint(Math.sqrt(-(2 * t - 3) * (2 * t - 1)), 1);
}

/** <https://easings.net/#easeInExpo> - there is a small discontinuity at 0. */
export function exponential_in(t: number): number {
  return t === 0 ? t : Math.pow(2.0, 10 * (t - 1));
}

/** <https://easings.net/#easeOutExpo> - there is a small discontinuity at 1. */
export function exponential_out(t: number): number {
  return t === 1 ? t : 1 - Math.pow(2.0, -10 * t);
}

/** <https://easings.net/#easeInOutExpo> - discontinuities at both 0 and 1. */
export function exponential_in_out(t: number): number {
  if (t === 0 || t === 1) {
    return t;
  }
  if (t < 0.5) {
    return 0.5 * Math.pow(2.0, 20 * t - 10);
  }
  return 0.5 * Math.pow(2.0, -20 * t + 10) + 1;
}

/** <https://easings.net/#easeInBack> */
export function back_in(t: number): number {
  return t * t * t - t * Math.sin(t * PI);
}

/** <https://easings.net/#easeOutBack> */
export function back_out(t: number): number {
  const f = 1 - t;
  return 1 - (f * f * f - f * Math.sin(f * PI));
}

/** <https://easings.net/#easeInOutBack> */
export function back_in_out(t: number): number {
  if (t < 0.5) {
    const f = 2 * t;
    return 0.5 * (f * f * f - f * Math.sin(f * PI));
  }
  const f = 1 - (2 * t - 1);
  return 0.5 * (1 - (f * f * f - f * Math.sin(f * PI))) + 0.5;
}

/** <https://easings.net/#easeInBounce> - each bounce is modelled as a parabola. */
export function bounce_in(t: number): number {
  return 1 - bounce_out(1 - t);
}

/** <https://easings.net/#easeOutBounce> - each bounce is modelled as a parabola. */
export function bounce_out(t: number): number {
  if (t < 4 / 11) {
    const T2 = 121 / 16;
    return T2 * t * t;
  }
  if (t < 8 / 11) {
    const T2 = 363 / 40;
    const T1 = -99 / 10;
    const T0 = 17 / 5;
    return T2 * t * t + T1 * t + T0;
  }
  if (t < 9 / 10) {
    const T2 = 4356 / 361;
    const T1 = -35442 / 1805;
    const T0 = 16061 / 1805;
    return T2 * t * t + T1 * t + T0;
  }
  const T2 = 54 / 5;
  const T1 = -513 / 25;
  const T0 = 268 / 25;
  return T2 * t * t + T1 * t + T0;
}

/** <https://easings.net/#easeInOutBounce> - each bounce is modelled as a parabola. */
export function bounce_in_out(t: number): number {
  if (t < 0.5) {
    return 0.5 * bounce_in(t * 2);
  }
  return 0.5 * bounce_out(t * 2 - 1) + 0.5;
}

/** Every easing function, keyed by name, for runtime lookup. */
export const EASINGS = {
  linear,
  quadratic_in,
  quadratic_out,
  quadratic_in_out,
  cubic_in,
  cubic_out,
  cubic_in_out,
  sin_in,
  sin_out,
  sin_in_out,
  circular_in,
  circular_out,
  circular_in_out,
  exponential_in,
  exponential_out,
  exponential_in_out,
  back_in,
  back_out,
  back_in_out,
  bounce_in,
  bounce_out,
  bounce_in_out,
} as const;

export type EasingName = keyof typeof EASINGS;

/** All easing functions, as a list of `{name, fn}` pairs. */
export const ALL_EASINGS: readonly { name: EasingName; fn: (t: number) => number }[] = (
  Object.keys(EASINGS) as EasingName[]
).map((name) => ({ name, fn: EASINGS[name] }));