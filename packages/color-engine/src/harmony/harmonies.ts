import type { OKLCHValues, ColorHarmony, HarmonyColor } from '@hue-und-you/types';
import { oklchToRgb, rgbToHex } from '@/conversion';

function rotateHue(h: number, deg: number): number {
  return (h + deg + 360) % 360;
}

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
