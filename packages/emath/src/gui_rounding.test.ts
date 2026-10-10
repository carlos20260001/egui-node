import { describe, expect, it } from 'vitest';

import { GUI_ROUNDING, floor_ui, round_to_pixel_center, round_to_pixels, round_ui } from './gui_rounding.js';
import { pos2 } from './pos2.js';
import { Rect } from './rect.js';
import { vec2 } from './vec2.js';

// Straight from `test_gui_rounding` in emath/src/gui_rounding.rs.
describe('gui rounding', () => {
  it('rounds to an even multiple of GUI_ROUNDING', () => {
    expect(round_ui(0.0)).toBe(0.0);
    expect(round_ui(GUI_ROUNDING * 1.11)).toBe(GUI_ROUNDING);
    expect(round_ui(-GUI_ROUNDING * 1.11)).toBe(-GUI_ROUNDING);
    expect(round_ui(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
    expect(round_ui(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });

  it('floors towards negative infinity', () => {
    expect(floor_ui(0.0)).toBe(0.0);
    expect(floor_ui(GUI_ROUNDING * 1.11)).toBe(GUI_ROUNDING);
    expect(floor_ui(-GUI_ROUNDING * 1.11)).toBe(-GUI_ROUNDING * 2);
  });

  it('rounds to pixel centres', () => {
    expect(round_to_pixel_center(0.17, 2.0)).toBe(0.25);
  });

  it('rounds to whole pixels', () => {
    expect(round_to_pixels(1.24, 1.0)).toBe(1.0);
    expect(round_to_pixels(1.26, 1.0)).toBe(1.0);
    expect(round_to_pixels(1.6, 2.0)).toBe(1.5);
  });

  it('keeps adjacent rects tiling when rounded', () => {
    const left = Rect.from_min_max(pos2(0, 0), pos2(10.01, 5)).round_ui();
    const right = Rect.from_min_max(pos2(10.01, 0), pos2(20, 5)).round_ui();
    expect(left.right()).toBe(right.left());
  });

  it('exposes the same operations on Vec2 and Pos2', () => {
    expect(vec2(1.01, 1.01).round_ui().equals(vec2(round_ui(1.01), round_ui(1.01)))).toBe(true);
    expect(pos2(1.01, 1.01).round_ui().equals(pos2(round_ui(1.01), round_ui(1.01)))).toBe(true);
    expect(
      Rect.from_min_max(pos2(0, 0), pos2(1.01, 1.01))
        .round_ui()
        .equals(Rect.from_min_max(pos2(0, 0).round_ui(), pos2(1.01, 1.01).round_ui())),
    ).toBe(true);
  });
});