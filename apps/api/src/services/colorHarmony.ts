import type { OKLCHValues, TintShade, ColorHarmony, HarmonyColor } from '@hue-und-you/types';
import { oklchToRgb, rgbToHex } from './colorConversion';

// ============================================
// ROTATE HUE
// ============================================

function rotateHue(h: number, deg: number): number {
  return (h + deg + 360) % 360;
}

// ============================================
// CREATE HARMONY COLOR
// ============================================

function makeHarmonyColor(oklch: OKLCHValues, hue: number, name: string): HarmonyColor {
  const harmonicOklch: OKLCHValues = { l: oklch.l, c: oklch.c, h: hue };
  const rgb = oklchToRgb(harmonicOklch);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

  return {
    hex,
    oklch: `oklch(${(oklch.l * 100).toFixed(2)}% ${oklch.c.toFixed(3)} ${hue.toFixed(1)})`,
    name,
  };
}

// ============================================
// GENERATE COLOR HARMONIES
// ============================================

export function generateHarmonies(oklch: OKLCHValues): ColorHarmony {
  return {
    complementary: makeHarmonyColor(oklch, rotateHue(oklch.h, 180), 'Complementary'),
    analogous: [
      makeHarmonyColor(oklch, rotateHue(oklch.h, 30), 'Analogous 1'),
      makeHarmonyColor(oklch, rotateHue(oklch.h, -30), 'Analogous 2'),
    ],
    triadic: [
      makeHarmonyColor(oklch, rotateHue(oklch.h, 120), 'Triadic 1'),
      makeHarmonyColor(oklch, rotateHue(oklch.h, 240), 'Triadic 2'),
    ],
    split_complementary: [
      makeHarmonyColor(oklch, rotateHue(oklch.h, 150), 'Split 1'),
      makeHarmonyColor(oklch, rotateHue(oklch.h, 210), 'Split 2'),
    ],
  };
}

// ============================================
// GENERATE TINTS (lighter variations)
// ============================================

export function generateTints(
  oklch: OKLCHValues,
  colorName: string,
  count: number = 4
): TintShade[] {
  const tints: TintShade[] = [];

  for (let i = 1; i <= count; i++) {
    const tintL = Math.min(oklch.l + i * 0.1, 0.99);
    const tintOklch: OKLCHValues = { l: tintL, c: oklch.c, h: oklch.h };
    const tintRgb = oklchToRgb(tintOklch);
    const tintHex = rgbToHex(tintRgb.r, tintRgb.g, tintRgb.b);

    tints.push({
      level: i * 10,
      hex: tintHex,
      oklch: `oklch(${(tintL * 100).toFixed(2)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`,
      name: `${colorName} ${400 - i * 100}`,
    });
  }

  return tints;
}

// ============================================
// GENERATE SHADES (darker variations)
// ============================================

export function generateShades(
  oklch: OKLCHValues,
  colorName: string,
  count: number = 4
): TintShade[] {
  const shades: TintShade[] = [];

  for (let i = 1; i <= count; i++) {
    const shadeL = Math.max(oklch.l - i * 0.1, 0.01);
    const shadeOklch: OKLCHValues = { l: shadeL, c: oklch.c, h: oklch.h };
    const shadeRgb = oklchToRgb(shadeOklch);
    const shadeHex = rgbToHex(shadeRgb.r, shadeRgb.g, shadeRgb.b);

    shades.push({
      level: i * 10,
      hex: shadeHex,
      oklch: `oklch(${(shadeL * 100).toFixed(2)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`,
      name: `${colorName} ${500 + i * 100}`,
    });
  }

  return shades;
}

// ============================================
// GENERATE BOTH TINTS AND SHADES
// ============================================

export function generateTintsAndShades(
  oklch: OKLCHValues,
  colorName: string
): { tints: TintShade[]; shades: TintShade[] } {
  return {
    tints: generateTints(oklch, colorName),
    shades: generateShades(oklch, colorName),
  };
}
