import type { OKLCHValues, TintShade } from '@hue-und-you/types';
import { oklchToRgb, rgbToHex } from '@/conversion';

export function generateTints(
  oklch: OKLCHValues,
  colorName: string,
  count: number = 4
): TintShade[] {
  const tints: TintShade[] = [];
  const { l, c, h } = oklch;

  const isVeryLight = l > 0.85;
  const isLight = l > 0.7;

  const headroom = 0.99 - l;

  for (let i = 1; i <= count; i++) {
    let tintL: number;
    let tintC: number;

    if (isVeryLight) {
      const step = Math.min(headroom / count, 0.02);
      tintL = Math.min(l + i * step, 0.99);
      tintC = c * (1 - (i / count) * 0.5);
    } else if (isLight) {
      const step = Math.min(headroom / count, 0.05);
      tintL = Math.min(l + i * step, 0.99);
      tintC = c * (1 - (i / count) * 0.3);
    } else {
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

export function generateShades(
  oklch: OKLCHValues,
  colorName: string,
  count: number = 4
): TintShade[] {
  const shades: TintShade[] = [];
  const { l, c, h } = oklch;

  const isVeryDark = l < 0.25;
  const isDark = l < 0.4;

  const room = l - 0.01;

  for (let i = 1; i <= count; i++) {
    let shadeL: number;
    let shadeC: number;

    if (isVeryDark) {
      const step = Math.min(room / count, 0.02);
      shadeL = Math.max(l - i * step, 0.01);
      shadeC = c * (1 - (i / count) * 0.6);
    } else if (isDark) {
      const step = Math.min(room / count, 0.05);
      shadeL = Math.max(l - i * step, 0.01);
      shadeC = c * (1 - (i / count) * 0.4);
    } else {
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

export function generateTintsAndShades(
  oklch: OKLCHValues,
  colorName: string
): { tints: TintShade[]; shades: TintShade[] } {
  return {
    tints: generateTints(oklch, colorName),
    shades: generateShades(oklch, colorName),
  };
}
