import { describe, expect, it } from 'vitest';

import { Color32 } from './color32.js';
import { HexColor, color32_from_hex, color32_to_hex, hex_color } from './hex_color_runtime.js';
import { Hsva, hsv_from_rgb, rgb_from_hsv } from './hsva.js';
import { HsvaGamma } from './hsva_gamma.js';
import { Rgba } from './rgba.js';
import { tint_color_towards } from './lib.js';

describe('HexColor', () => {
  // Straight from `hex_string_formats` in ecolor/src/hex_color_runtime.rs.
  it('formats and parses every width', () => {
    const C = Color32;
    const cases: [HexColor, string][] = [
      [HexColor.hex3(C.RED), '#f00'],
      [HexColor.hex4(C.RED), '#f00f'],
      [HexColor.hex6(C.RED), '#ff0000'],
      [HexColor.hex8(C.RED), '#ff0000ff'],
      [HexColor.hex3(C.GREEN), '#0f0'],
      [HexColor.hex4(C.GREEN), '#0f0f'],
      [HexColor.hex6(C.GREEN), '#00ff00'],
      [HexColor.hex8(C.GREEN), '#00ff00ff'],
      [HexColor.hex3(C.BLUE), '#00f'],
      [HexColor.hex4(C.BLUE), '#00ff'],
      [HexColor.hex6(C.BLUE), '#0000ff'],
      [HexColor.hex8(C.BLUE), '#0000ffff'],
      [HexColor.hex3(C.WHITE), '#fff'],
      [HexColor.hex4(C.WHITE), '#ffff'],
      [HexColor.hex6(C.WHITE), '#ffffff'],
      [HexColor.hex8(C.WHITE), '#ffffffff'],
      [HexColor.hex3(C.BLACK), '#000'],
      [HexColor.hex4(C.BLACK), '#000f'],
      [HexColor.hex6(C.BLACK), '#000000'],
      [HexColor.hex8(C.BLACK), '#000000ff'],
      [HexColor.hex4(C.TRANSPARENT), '#0000'],
      [HexColor.hex8(C.TRANSPARENT), '#00000000'],
    ];
    for (const [color, string] of cases) {
      expect(color.toString()).toBe(string);
      const parsed = HexColor.from_str(string);
      expect(parsed.ok, `${string} should parse`).toBe(true);
      if (parsed.ok) {
        expect(parsed.value.equals(color), `${string} <=> ${color.toString()}`).toBe(true);
      }
    }
  });

  // Straight from `hex_string_round_trip` in ecolor/src/hex_color_runtime.rs.
  it('round-trips arbitrary colours', () => {
    const cases: [number, number, number, number][] = [
      [0, 20, 30, 0],
      [10, 0, 30, 40],
      [10, 100, 200, 0],
      [10, 100, 200, 100],
      [10, 100, 200, 200],
      [10, 100, 200, 255],
      [10, 100, 200, 40],
      [10, 20, 0, 255],
      [10, 20, 30, 0],
      [10, 20, 30, 255],
      [10, 20, 30, 40],
    ];
    for (const [r, g, b, a] of cases) {
      const color = Color32.from_rgba_unmultiplied(r, g, b, a);
      expect(color32_from_hex(color.to_hex()).equals(color)).toBe(true);
    }
  });

  it('reports parse errors', () => {
    const missing = HexColor.from_str('ff0000');
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.kind).toBe('MissingHash');

    // 5 digits is not one of 3, 4, 6 or 8.
    const badLen = HexColor.from_str('#ff000');
    expect(badLen.ok).toBe(false);
    if (!badLen.ok) {
      expect(badLen.error.kind).toBe('InvalidLength');
      if (badLen.error.kind === 'InvalidLength') expect(badLen.error.length).toBe(5);
    }

    const badInt = HexColor.from_str('#gggggg');
    expect(badInt.ok).toBe(false);
    if (!badInt.ok) {
      expect(badInt.error.kind).toBe('InvalidInt');
      if (badInt.error.kind === 'InvalidInt') expect(badInt.error.position).toBe(0);
    }
  });

  it('exposes the runtime Color32::from_hex helpers', () => {
    expect(color32_from_hex('#ff0000').equals(Color32.RED)).toBe(true);
    expect(color32_from_hex('#00ff00ff').equals(Color32.GREEN)).toBe(true);
    expect(color32_from_hex('#00f').equals(Color32.BLUE)).toBe(true);
    expect(color32_from_hex('#0000').equals(Color32.TRANSPARENT)).toBe(true);

    expect(color32_to_hex(Color32.RED)).toBe('#ff0000ff');
    expect(color32_to_hex(Color32.GREEN)).toBe('#00ff00ff');
    expect(color32_to_hex(Color32.BLUE)).toBe('#0000ffff');
    expect(color32_to_hex(Color32.TRANSPARENT)).toBe('#00000000');
  });

  it('hex_color matches the proc macro', () => {
    expect(hex_color('#202122').equals(Color32.from_rgb(0x20, 0x21, 0x22))).toBe(true);
    expect(hex_color('202122').equals(Color32.from_rgb(0x20, 0x21, 0x22))).toBe(true);
    expect(hex_color('#abcdef12').equals(Color32.from_rgba_unmultiplied(0xab, 0xcd, 0xef, 0x12))).toBe(true);
  });
});

describe('Hsva', () => {
  it('round-trips primary colours', () => {
    const cases: [number, number, number][] = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [255, 255, 255],
      [0, 0, 0],
      [10, 100, 200],
    ];
    for (const [r, g, b] of cases) {
      const srgba = Color32.from_rgb(r, g, b);
      const hsva = Hsva.fromColor32(srgba);
      expect(hsva.toColor32().equals(srgba), `${r},${g},${b}`).toBe(true);
    }
  });

  it('computes hue correctly', () => {
    // Red is hue 0, green 1/3, blue 2/3.
    expect(hsv_from_rgb([1, 0, 0])[0]).toBeCloseTo(0, 6);
    expect(hsv_from_rgb([0, 1, 0])[0]).toBeCloseTo(1 / 3, 6);
    expect(hsv_from_rgb([0, 0, 1])[0]).toBeCloseTo(2 / 3, 6);
  });

  it('wraps hue', () => {
    // A negative hue should wrap into [0, 1).
    const [h] = hsv_from_rgb([-1, -0.5, -0.25]);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });

  it('round-trips hsv -> rgb -> hsv', () => {
    for (const rgb of [
      [1, 0, 0],
      [0.5, 0.5, 0.5],
      [0.2, 0.7, 0.3],
    ] as [number, number, number][]) {
      const hsv = hsv_from_rgb(rgb);
      expect(rgb_from_hsv(hsv)[0]).toBeCloseTo(rgb[0], 5);
      expect(rgb_from_hsv(hsv)[1]).toBeCloseTo(rgb[1], 5);
      expect(rgb_from_hsv(hsv)[2]).toBeCloseTo(rgb[2], 5);
    }
  });

  it('handles zero saturation and value', () => {
    const [h, s, v] = hsv_from_rgb([0.5, 0.5, 0.5]);
    expect(s).toBe(0);
    expect(v).toBe(0.5);
    expect(h).toBe(0);

    expect(hsv_from_rgb([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('treats negative alpha as additive', () => {
    const additive = Hsva.from_additive_rgb([1, 0, 0]);
    expect(additive.a).toBeLessThan(0);
    // to_rgba_premultiplied zeroes the alpha for additive colours.
    expect(additive.to_rgba_premultiplied()[3]).toBe(0);
  });
});

describe('HsvaGamma', () => {
  it('round-trips through Hsva', () => {
    const hsva = Hsva.new(0.5, 0.7, 0.3, 1.0);
    const gamma = HsvaGamma.fromHsva(hsva);
    const back = gamma.toHsva();
    expect(back.h).toBeCloseTo(hsva.h, 6);
    expect(back.s).toBeCloseTo(hsva.s, 6);
    expect(back.v).toBeCloseTo(hsva.v, 6);
    expect(back.a).toBeCloseTo(hsva.a, 6);
  });

  it('round-trips through Color32', () => {
    for (const c of [Color32.RED, Color32.GRAY, Color32.BLUE, Color32.WHITE]) {
      expect(HsvaGamma.fromColor32(c).toColor32().equals(c)).toBe(true);
    }
  });

  it('round-trips through Rgba', () => {
    const rgba = Rgba.from_rgb(0.2, 0.4, 0.6);
    // Going via Hsva applies a gamma encode/decode, so compare with a tolerance.
    const back = HsvaGamma.fromRgba(rgba).toRgba();
    expect(back.r).toBeCloseTo(rgba.r, 5);
    expect(back.g).toBeCloseTo(rgba.g, 5);
    expect(back.b).toBeCloseTo(rgba.b, 5);
    expect(back.a).toBe(rgba.a);
  });
});

describe('tint_color_towards', () => {
  it('darkens toward the target', () => {
    const tinted = tint_color_towards(Color32.from_rgb(200, 200, 200), Color32.BLACK);
    expect(tinted.r).toBeLessThan(200);
    expect(tinted.g).toBeLessThan(200);
  });

  it('leaves fully transparent colours transparent', () => {
    const tinted = tint_color_towards(Color32.TRANSPARENT, Color32.BLACK);
    expect(tinted.a).toBe(0);
  });

  it('always returns a valid u8 colour', () => {
    for (const alpha of [0, 1, 10, 100, 169, 170, 255]) {
      for (const c of [Color32.from_rgba_premultiplied(255, 255, 255, alpha), Color32.from_rgba_premultiplied(10, 20, 30, alpha)]) {
        const tinted = tint_color_towards(c, Color32.from_rgb(255, 200, 100));
        for (const v of [tinted.r, tinted.g, tinted.b, tinted.a]) {
          expect(Number.isInteger(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(255);
        }
      }
    }
  });
});