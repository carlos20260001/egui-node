import { describe, expect, it } from 'vitest';

import { pos2, vec2, Rect } from '@egui-node/emath';
import { Color32 } from '@egui-node/ecolor';

import { CornerRadius } from './corner_radius.js';
import { CornerRadiusF32 } from './corner_radius_f32.js';
import { Margin, rectAddMargin, rectSubMargin } from './margin.js';
import { MarginF32 } from './margin_f32.js';
import { is_nearest_integer_odd, PathStroke, Stroke } from './stroke.js';
import { colorModeEquals, colorModeSolid, colorModeUv, TRANSPARENT_COLOR_MODE } from './color.js';
import { Brush } from './brush.js';
import { DEFAULT_TEXTURE_ID, managed, user, compareTextureId } from './texture_id.js';
import { I8_MAX, I8_MIN, sat_i8 } from './internal.js';

describe('Margin', () => {
  it('constructs', () => {
    expect(Margin.same(4).equals(new Margin(4, 4, 4, 4))).toBe(true);
    expect(Margin.symmetric(1, 2).equals(new Margin(1, 1, 2, 2))).toBe(true);
    expect(Margin.same(4).is_same()).toBe(true);
    expect(Margin.symmetric(1, 2).is_same()).toBe(false);
  });

  it('converts', () => {
    expect(Margin.fromVec2(vec2(1.4, 2.6)).equals(new Margin(1, 1, 3, 3))).toBe(true);
    expect(Margin.from_f32(2.6).equals(Margin.same(3))).toBe(true);
    // Rust's `as i8` saturates rather than wrapping.
    expect(Margin.from_f32(1000).left).toBe(I8_MAX);
    expect(Margin.from_f32(-1000).left).toBe(I8_MIN);
  });

  it('sums sides', () => {
    expect(Margin.same(2).sum().equals(vec2(4, 4))).toBe(true);
    expect(Margin.symmetric(1, 2).left_top().equals(vec2(1, 2))).toBe(true);
    expect(Margin.symmetric(1, 2).right_bottom().equals(vec2(1, 2))).toBe(true);
  });

  it('adds and subtracts with saturation', () => {
    expect(Margin.same(100).add(Margin.same(100)).left).toBe(I8_MAX);
    expect(Margin.same(-100).sub(Margin.same(100)).left).toBe(I8_MIN);
    expect(Margin.same(10).add(5).left).toBe(15);
    expect(Margin.same(10).sub(5).left).toBe(5);
  });

  it('scales', () => {
    expect(Margin.same(10).mul(2).left).toBe(20);
    expect(Margin.same(10).div(2).left).toBe(5);
    // Rust computes `self * v.recip()`.
    expect(Margin.same(10).div(4).left).toBe(3); // round(10 * 0.25) = 3 (2.5 -> away from zero)
  });

  it('grows and shrinks rects', () => {
    const r = Rect.from_min_max(pos2(0, 0), pos2(10, 10));
    expect(rectAddMargin(r, Margin.same(2)).equals(Rect.from_min_max(pos2(-2, -2), pos2(12, 12)))).toBe(true);
    expect(rectSubMargin(r, Margin.same(2)).equals(Rect.from_min_max(pos2(2, 2), pos2(8, 8)))).toBe(true);
  });
});

describe('MarginF32', () => {
  it('round-trips through Margin', () => {
    // Note the asymmetry that exists in the Rust source: `MarginF32 -> Margin`
    // uses a plain `as` cast, which TRUNCATES, whereas `Margin::from_f32` calls
    // `.round()` first. So 4.5 goes back as 4, not 5.
    expect(MarginF32.same(4.5).toMargin().equals(Margin.same(4))).toBe(true);
    expect(MarginF32.fromMargin(Margin.same(-3)).equals(MarginF32.same(-3))).toBe(true);
    // ...while `Margin::from_f32` does round.
    expect(Margin.from_f32(4.5).equals(Margin.same(5))).toBe(true);
  });

  it('does float arithmetic', () => {
    expect(MarginF32.same(1.5).add(MarginF32.same(2.5)).left).toBe(4);
    expect(MarginF32.same(1.5).mul(2).left).toBe(3);
    expect(MarginF32.same(3).div(2).left).toBe(1.5);
  });
});

describe('CornerRadius', () => {
  it('constructs and compares', () => {
    expect(CornerRadius.same(4).is_same()).toBe(true);
    expect(CornerRadius.ZERO.is_same()).toBe(true);
    expect(new CornerRadius(1, 2, 3, 4).is_same()).toBe(false);
    expect(CornerRadius.from_f32(3.6).equals(CornerRadius.same(4))).toBe(true);
    // `as u8` saturates.
    expect(CornerRadius.from_f32(1000).nw).toBe(255);
  });

  it('clamps', () => {
    expect(new CornerRadius(1, 5, 10, 20).at_least(4).equals(new CornerRadius(4, 5, 10, 20))).toBe(true);
    expect(new CornerRadius(1, 5, 10, 20).at_most(9).equals(new CornerRadius(1, 5, 9, 9))).toBe(true);
  });

  it('averages', () => {
    expect(new CornerRadius(0, 10, 20, 30).average()).toBe(15);
  });

  it('saturates on add and sub', () => {
    expect(CornerRadius.same(200).add(CornerRadius.same(200)).nw).toBe(255);
    expect(CornerRadius.same(10).sub(CornerRadius.same(20)).nw).toBe(0);
    expect(CornerRadius.same(10).add(5).nw).toBe(15);
    expect(CornerRadius.same(10).sub(5).nw).toBe(5);
  });

  it('scales', () => {
    expect(CornerRadius.same(10).mul(2).nw).toBe(20);
    expect(CornerRadius.same(10).div(2).nw).toBe(5);
  });
});

describe('CornerRadiusF32', () => {
  // Straight from `add_and_sub_saturate_at_zero` in
  // epaint/src/corner_radius_f32.rs.
  it('adds and subs saturating at zero', () => {
    expect(CornerRadiusF32.same(2.0).add(CornerRadiusF32.same(-5.0)).equals(CornerRadiusF32.ZERO)).toBe(true);
    expect(CornerRadiusF32.same(2.0).sub(CornerRadiusF32.same(5.0)).equals(CornerRadiusF32.ZERO)).toBe(true);

    const cr = CornerRadiusF32.same(1.0);
    cr.add_assign(-3.0);
    expect(cr.equals(CornerRadiusF32.ZERO)).toBe(true);
    cr.sub_assign(-2.0);
    expect(cr.equals(CornerRadiusF32.same(2.0))).toBe(true);
  });

  it('sets corner groups', () => {
    expect(CornerRadiusF32.same(0).with_east(5).equals(new CornerRadiusF32(0, 5, 0, 5))).toBe(true);
    expect(CornerRadiusF32.same(0).with_north(5).equals(new CornerRadiusF32(5, 5, 0, 0))).toBe(true);
    expect(CornerRadiusF32.same(0).with_south(5).equals(new CornerRadiusF32(0, 0, 5, 5))).toBe(true);
    expect(CornerRadiusF32.same(0).with_west(5).equals(new CornerRadiusF32(5, 0, 5, 0))).toBe(true);
  });

  it('round-trips through CornerRadius', () => {
    expect(CornerRadiusF32.fromCornerRadius(CornerRadius.same(7)).toCornerRadius().equals(CornerRadius.same(7))).toBe(true);
  });
});

// Straight from `test_is_nearest_integer_odd` in epaint/src/stroke.rs.
describe('is_nearest_integer_odd', () => {
  it('matches the Rust test', () => {
    expect(is_nearest_integer_odd(0.6)).toBe(true);
    expect(is_nearest_integer_odd(1.0)).toBe(true);
    expect(is_nearest_integer_odd(1.4)).toBe(true);
    expect(is_nearest_integer_odd(1.6)).toBe(false);
    expect(is_nearest_integer_odd(2.0)).toBe(false);
    expect(is_nearest_integer_odd(2.4)).toBe(false);
    expect(is_nearest_integer_odd(2.6)).toBe(true);
    expect(is_nearest_integer_odd(3.0)).toBe(true);
    expect(is_nearest_integer_odd(3.4)).toBe(true);
  });
});

describe('Stroke', () => {
  it('knows when it is empty', () => {
    expect(Stroke.NONE.is_empty()).toBe(true);
    expect(new Stroke(1.0, Color32.TRANSPARENT).is_empty()).toBe(true);
    expect(new Stroke(0.0, Color32.RED).is_empty()).toBe(true);
    expect(new Stroke(1.0, Color32.RED).is_empty()).toBe(false);
  });

  it('rounds centres to pixels', () => {
    const thin = new Stroke(0.5, Color32.RED);
    const odd = new Stroke(1.0, Color32.RED);
    const even = new Stroke(2.0, Color32.RED);
    // Thin and odd-width strokes snap to pixel centres; even ones to pixel edges.
    expect(thin.round_center_to_pixel(1.0, 0.4)).toBe(0.5);
    expect(odd.round_center_to_pixel(1.0, 0.4)).toBe(0.5);
    expect(even.round_center_to_pixel(1.0, 0.4)).toBe(0);
  });
});

describe('PathStroke', () => {
  it('converts from Stroke, collapsing empty strokes to NONE', () => {
    expect(PathStroke.fromStroke(Stroke.NONE).equals(PathStroke.NONE)).toBe(true);
    expect(PathStroke.fromStroke(new Stroke(2.0, Color32.RED)).kind).toBe('Middle');
    expect(PathStroke.fromStroke(new Stroke(2.0, Color32.RED)).width).toBe(2.0);
  });

  it('sets the kind', () => {
    const s = PathStroke.new(2.0, Color32.RED);
    expect(s.inside().kind).toBe('Inside');
    expect(s.outside().kind).toBe('Outside');
    expect(s.middle().kind).toBe('Middle');
    expect(s.with_kind('Outside').kind).toBe('Outside');
  });

  it('is empty when transparent', () => {
    expect(PathStroke.NONE.is_empty()).toBe(true);
    expect(PathStroke.new(1.0, Color32.RED).is_empty()).toBe(false);
  });

  it('supports UV callbacks', () => {
    const s = PathStroke.new_uv(2.0, () => Color32.BLUE);
    expect(s.color.kind).toBe('UV');
    // Rust's PartialEq says two UV modes are never equal.
    expect(s.equals(PathStroke.new_uv(2.0, () => Color32.BLUE))).toBe(false);
  });
});

describe('ColorMode', () => {
  it('compares solid modes but never UV modes', () => {
    expect(colorModeEquals(colorModeSolid(Color32.RED), colorModeSolid(Color32.RED))).toBe(true);
    expect(colorModeEquals(colorModeSolid(Color32.RED), colorModeSolid(Color32.BLUE))).toBe(false);
    expect(colorModeEquals(colorModeUv(() => Color32.RED), colorModeUv(() => Color32.RED))).toBe(false);
    expect(colorModeEquals(colorModeSolid(Color32.RED), colorModeUv(() => Color32.RED))).toBe(false);
  });

  it('has a transparent default', () => {
    expect(colorModeEquals(TRANSPARENT_COLOR_MODE, colorModeSolid(Color32.TRANSPARENT))).toBe(true);
  });
});

describe('Brush', () => {
  it('defaults to no texturing', () => {
    const b = new Brush();
    expect(b.fill_texture_id).toEqual(DEFAULT_TEXTURE_ID);
    expect(b.uv.equals(Rect.ZERO)).toBe(true);
  });
});

describe('TextureId', () => {
  it('orders by variant then id, like the Rust derived Ord', () => {
    expect(compareTextureId(managed(0), managed(1))).toBe(-1);
    expect(compareTextureId(managed(1), managed(0))).toBe(1);
    expect(compareTextureId(managed(1), user(0))).toBe(-1);
    expect(compareTextureId(managed(1), managed(1))).toBe(0);
  });

  it('defaults to the font texture', () => {
    expect(DEFAULT_TEXTURE_ID).toEqual({ kind: 'Managed', id: 0n });
  });
});

describe('i8 cast', () => {
  it('saturates rather than wrapping', () => {
    expect(sat_i8(200)).toBe(I8_MAX);
    expect(sat_i8(-200)).toBe(I8_MIN);
    expect(sat_i8(5.9)).toBe(5);
    expect(sat_i8(Number.NaN)).toBe(0);
  });
});