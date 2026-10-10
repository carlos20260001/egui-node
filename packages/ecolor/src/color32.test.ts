import { describe, expect, it } from 'vitest';

import { Color32 } from './color32.js';
import { Rgba } from './rgba.js';
import { color32_from_hex } from './hex_color_runtime.js';
import { fast_round, mul_frac_round, sat_u8 } from './internal.js';
import { gamma_u8_from_linear_f32, linear_f32_from_gamma_u8, linear_f32_from_linear_u8 } from './rgba.js';

/** Straight from `test_rgba()` in the `test` modules of color32.rs / rgba.rs. */
function testRgba(): [number, number, number, number][] {
  return [
    [0, 0, 0, 0],
    [0, 0, 0, 255],
    [10, 0, 30, 0],
    [10, 0, 30, 40],
    [10, 100, 200, 0],
    [10, 100, 200, 100],
    [10, 100, 200, 200],
    [10, 100, 200, 255],
    [10, 100, 200, 40],
    [10, 20, 0, 0],
    [10, 20, 0, 255],
    [10, 20, 30, 255],
    [10, 20, 30, 40],
    [255, 255, 255, 0],
    [255, 255, 255, 255],
  ];
}

describe('u8 cast semantics', () => {
  it('saturates like Rust\'s `as u8`', () => {
    expect(sat_u8(-5)).toBe(0);
    expect(sat_u8(5.9)).toBe(5);
    expect(sat_u8(300)).toBe(255);
    expect(sat_u8(Number.NaN)).toBe(0);
    expect(sat_u8(Number.POSITIVE_INFINITY)).toBe(255);
    expect(sat_u8(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('fast_round matches `(r + 0.5) as u8`', () => {
    expect(fast_round(0.4)).toBe(0);
    expect(fast_round(0.5)).toBe(1);
    expect(fast_round(254.5)).toBe(255);
    expect(fast_round(255.5)).toBe(255); // saturates, does not wrap
    expect(fast_round(-0.5)).toBe(0);
  });
});

describe('Color32', () => {
  // Straight from `test_color32_additive` in ecolor/src/color32.rs.
  it('blends additive colours', () => {
    const opaque = Color32.from_rgb(40, 50, 60);
    const additive = Color32.from_rgb(255, 127, 10).additive();
    expect(additive.blend(opaque).equals(opaque)).toBe(true); // opaque on top of additive
    expect(opaque.blend(additive).equals(Color32.from_rgb(255, 177, 70))).toBe(true); // additive on top of opaque
  });

  // Straight from `test_color32_blend_vs_gamma_blend` in ecolor/src/color32.rs.
  it('blends in gamma space', () => {
    const opaque = Color32.from_rgb(0x60, 0x60, 0x60);
    const transparent = Color32.from_rgba_unmultiplied(168, 65, 65, 79);
    expect(transparent.blend(opaque).equals(opaque)).toBe(true); // Opaque on top of transparent

    // Blending in gamma-space is the de-facto standard almost everywhere, and
    // so it is what users expect.
    expect(
      opaque
        .blend(transparent)
        .equals(
          Color32.from_rgb(
            blend(0x60, 168, 79),
            blend(0x60, 65, 79),
            blend(0x60, 65, 79),
          ),
        ),
    ).toBe(true);

    function blend(dest: number, src: number, alpha: number): number {
      const s = src / 255.0;
      const d = dest / 255.0;
      const al = alpha / 255.0;
      return fast_round((s * al + d * (1.0 - al)) * 255.0);
    }
  });

  // Straight from `color32_unmultiplied_round_trip` in ecolor/src/color32.rs.
  it('round-trips unmultiplied rgba', () => {
    for (const in_rgba of testRgba()) {
      const [r, g, b, a] = in_rgba;
      if (a === 0) {
        continue;
      }

      const c = Color32.from_rgba_unmultiplied(r, g, b, a);
      const out_rgba = c.to_srgba_unmultiplied();

      if (a === 255) {
        expect(out_rgba).toEqual(in_rgba);
      } else {
        // Small rounding errors are expected when alpha is not 0 or 255,
        // because we multiply and then unmultiply the alpha.
        for (let i = 0; i < 4; i++) {
          expect(Math.abs(in_rgba[i]! - out_rgba[i]!)).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  // Straight from `from_black_white_alpha` in ecolor/src/color32.rs.
  it('constructs black and white with alpha', () => {
    for (let a = 0; a <= 255; a++) {
      expect(Color32.from_white_alpha(a).equals(Color32.from_rgba_unmultiplied(255, 255, 255, a))).toBe(true);
      expect(Color32.from_white_alpha(a).equals(Color32.WHITE.gamma_multiply_u8(a))).toBe(true);

      expect(Color32.from_black_alpha(a).equals(Color32.from_rgba_unmultiplied(0, 0, 0, a))).toBe(true);
      expect(Color32.from_black_alpha(a).equals(Color32.BLACK.gamma_multiply_u8(a))).toBe(true);
    }
  });

  // Straight from `to_from_rgba` in ecolor/src/color32.rs.
  it('round-trips through Rgba', () => {
    for (const [r, g, b, a] of testRgba()) {
      const original = Color32.from_rgba_unmultiplied(r, g, b, a);
      const constfn = Color32.from_rgba_unmultiplied_const(r, g, b, a);
      const rgba = Rgba.fromColor32(original);
      const back = rgba.toColor32();
      expect(back.equals(original)).toBe(true);
      expect(constfn.equals(original)).toBe(true);
    }

    expect(color32_from_hex('#ff000080').equals(Color32.from_rgba_unmultiplied(255, 0, 0, 128))).toBe(true);
    expect(Rgba.from_rgba_unmultiplied(1.0, 0.0, 0.0, 0.5).toColor32().equals(Color32.from_rgba_unmultiplied(255, 0, 0, 128))).toBe(true);
  });

  // Straight from `mul_frac_round_vs_old` in ecolor/src/color32.rs.
  it('mul_frac_round matches the float version', () => {
    for (let x = 0; x <= 255; x += 4) {
      for (let a = 1; a <= 255; a += 4) {
        const old = fast_round(x * linear_f32_from_linear_u8(a));
        expect(old, `x=${x} a=${a}`).toBe(mul_frac_round(x, a));
      }
    }
  });

  it('has the documented constants', () => {
    expect(Color32.TRANSPARENT.equals(Color32.from_rgba_premultiplied(0, 0, 0, 0))).toBe(true);
    expect(Color32.RED.equals(Color32.from_rgb(255, 0, 0))).toBe(true);
    expect(Color32.DARK_GRAY.equals(Color32.from_rgb(96, 96, 96))).toBe(true);
    expect(Color32.PLACEHOLDER.equals(Color32.from_rgba_premultiplied(64, 254, 0, 128))).toBe(true);
    expect(Color32.RED.is_opaque()).toBe(true);
    expect(Color32.TRANSPARENT.is_additive()).toBe(true);
  });

  it('saturates on add', () => {
    expect(Color32.WHITE.add(Color32.WHITE).equals(Color32.from_rgba_premultiplied(255, 255, 255, 255))).toBe(true);
  });

  it('supports index access like the Rust Index impls', () => {
    const c = Color32.from_rgb(1, 2, 3);
    expect(c.get(0)).toBe(1);
    expect(c.get(3)).toBe(255);
    expect(() => c.get(4)).toThrow(RangeError);
  });

  it('formats like Rust Debug', () => {
    expect(Color32.from_rgb(0x20, 0x21, 0x22).toString()).toBe('#20_21_22_FF');
  });
});

describe('Rgba', () => {
  // Straight from `test_rgba_blend` in ecolor/src/rgba.rs.
  it('blends in linear space', () => {
    const opaque = Rgba.from_rgb(0.4, 0.5, 0.6);
    const transparent = Rgba.from_rgb(1.0, 0.5, 0.0).multiply(0.3);
    expect(transparent.blend(opaque).equals(opaque)).toBe(true); // Opaque on top of transparent
    expect(
      opaque
        .blend(transparent)
        .equals(
          Rgba.from_rgb(0.7 * 0.4 + 0.3 * 1.0, 0.7 * 0.5 + 0.3 * 0.5, 0.7 * 0.6 + 0.3 * 0.0),
        ),
    ).toBe(true);
  });

  // Straight from `test_rgba_roundtrip` in ecolor/src/rgba.rs.
  it('round-trips through srgba', () => {
    for (const in_rgba of testRgba()) {
      const [r, g, b, a] = in_rgba;
      if (a === 0) {
        continue;
      }
      const rgba = Rgba.from_srgba_unmultiplied(r, g, b, a);
      const out_rgba = rgba.to_srgba_unmultiplied();

      if (a === 255) {
        expect(out_rgba).toEqual(in_rgba);
      } else {
        for (let i = 0; i < 4; i++) {
          expect(Math.abs(in_rgba[i]! - out_rgba[i]!)).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('supports overloaded multiplication', () => {
    const c = Rgba.from_rgb(0.4, 0.5, 0.6);
    expect(c.mul(0.5).equals(new Rgba(0.2, 0.25, 0.3, 0.5))).toBe(true);
    // Component-wise multiplication accumulates float error, so compare with a
    // tolerance rather than exactly.
    const squared = c.mul(c);
    expect(squared.r).toBeCloseTo(0.4 * 0.4, 10);
    expect(squared.g).toBeCloseTo(0.5 * 0.5, 10);
    expect(squared.b).toBeCloseTo(0.6 * 0.6, 10);
    expect(squared.a).toBe(1);
  });

  it('supports index access like the Rust Index impls', () => {
    const c = new Rgba(1, 2, 3, 4);
    expect(c.get(3)).toBe(4);
    expect(() => c.get(4)).toThrow(RangeError);
  });
});

// Straight from `test_srgba_conversion` in ecolor/src/lib.rs.
describe('srgba conversion', () => {
  it('round-trips every gamma u8 value', () => {
    for (let b = 0; b <= 255; b++) {
      const l = linear_f32_from_gamma_u8(b);
      expect(l).toBeGreaterThanOrEqual(0.0);
      expect(l).toBeLessThanOrEqual(1.0);
      expect(gamma_u8_from_linear_f32(l)).toBe(b);
    }
  });
});