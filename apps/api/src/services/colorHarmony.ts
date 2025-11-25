import type { OKLCHValues, TintShade } from '@hue-und-you/types';
import { oklchToRgb, rgbToHex } from './colorConversion';

// ============================================
// ROTATE HUE
// ============================================

function rotateHue(h: number, deg: number): number {
  return (h + deg + 360) % 360;
}

// ============================================
// ADAPTIVE TINT/SHADE GENERATION
// Handles edge cases for very light/dark colors
// ============================================

/**
 * Generate tints with adaptive step sizes based on current lightness
 * For already-light colors, use smaller steps and chroma adjustments
 */
export function generateTints(
  oklch: OKLCHValues,
  colorName: string,
  count: number = 4
): TintShade[] {
  const tints: TintShade[] = [];
  const { l, c, h } = oklch;

  // Detect if color is already very light
  const isVeryLight = l > 0.85;
  const isLight = l > 0.7;

  // Calculate maximum headroom for lightness increase
  const headroom = 0.99 - l;

  for (let i = 1; i <= count; i++) {
    let tintL: number;
    let tintC: number;

    if (isVeryLight) {
      // For very light colors, use tiny lightness steps and reduce chroma
      const step = Math.min(headroom / count, 0.02);
      tintL = Math.min(l + i * step, 0.99);
      // Gradually reduce chroma as we approach white
      tintC = c * (1 - (i / count) * 0.5);
    } else if (isLight) {
      // For light colors, use smaller steps
      const step = Math.min(headroom / count, 0.05);
      tintL = Math.min(l + i * step, 0.99);
      // Slight chroma reduction
      tintC = c * (1 - (i / count) * 0.3);
    } else {
      // Normal case: standard increments
      tintL = Math.min(l + i * 0.1, 0.99);
      tintC = c;
    }

    const tintOklch: OKLCHValues = { l: tintL, c: tintC, h };
    const tintRgb = oklchToRgb(tintOklch);
    const tintHex = rgbToHex(tintRgb.r, tintRgb.g, tintRgb.b);

    tints.push({
      level: i * 10,
      hex: tintHex,
      oklch: `oklch(${(tintL * 100).toFixed(2)}% ${tintC.toFixed(3)} ${h.toFixed(1)})`,
      name: `${colorName} ${400 - i * 100}`,
    });
  }

  return tints;
}

/**
 * Generate shades with adaptive step sizes based on current lightness
 * For already-dark colors, use smaller steps and chroma adjustments
 */
export function generateShades(
  oklch: OKLCHValues,
  colorName: string,
  count: number = 4
): TintShade[] {
  const shades: TintShade[] = [];
  const { l, c, h } = oklch;

  // Detect if color is already very dark
  const isVeryDark = l < 0.25;
  const isDark = l < 0.4;

  // Calculate maximum room for darkening
  const room = l - 0.01;

  for (let i = 1; i <= count; i++) {
    let shadeL: number;
    let shadeC: number;

    if (isVeryDark) {
      // For very dark colors, use tiny steps and reduce chroma
      const step = Math.min(room / count, 0.02);
      shadeL = Math.max(l - i * step, 0.01);
      // Gradually reduce chroma as we approach black
      shadeC = c * (1 - (i / count) * 0.6);
    } else if (isDark) {
      // For dark colors, use smaller steps
      const step = Math.min(room / count, 0.05);
      shadeL = Math.max(l - i * step, 0.01);
      // Moderate chroma reduction
      shadeC = c * (1 - (i / count) * 0.4);
    } else {
      // Normal case: standard increments
      shadeL = Math.max(l - i * 0.1, 0.01);
      shadeC = c;
    }

    const shadeOklch: OKLCHValues = { l: shadeL, c: shadeC, h };
    const shadeRgb = oklchToRgb(shadeOklch);
    const shadeHex = rgbToHex(shadeRgb.r, shadeRgb.g, shadeRgb.b);

    shades.push({
      level: i * 10,
      hex: shadeHex,
      oklch: `oklch(${(shadeL * 100).toFixed(2)}% ${shadeC.toFixed(3)} ${h.toFixed(1)})`,
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

// ============================================
// COLOR HARMONIES
// ============================================

function makeHarmonyColor(oklch: OKLCHValues, hue: number, name: string) {
  const harmonicOklch: OKLCHValues = { l: oklch.l, c: oklch.c, h: hue };
  const rgb = oklchToRgb(harmonicOklch);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

  return {
    hex,
    oklch: `oklch(${(oklch.l * 100).toFixed(2)}% ${oklch.c.toFixed(3)} ${hue.toFixed(1)})`,
    name,
  };
}

export function generateHarmonies(oklch: OKLCHValues) {
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
