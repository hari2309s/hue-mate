import type { PixelData } from '../../../types/segmentation';
import { rgbToHsl } from '../conversion';

export function applySaturationBias(pixels: PixelData[]): PixelData[] {
  const biased: PixelData[] = [];

  for (const pixel of pixels) {
    const hsl = rgbToHsl(pixel.r, pixel.g, pixel.b);
    const saturation = hsl.s;

    let saturationBoost = 1;

    if (saturation > 75) {
      saturationBoost = Math.pow(saturation / 100, 1.5) * 12;
    } else if (saturation > 50) {
      saturationBoost = Math.pow(saturation / 100, 1.6) * 7;
    } else if (saturation > 25) {
      saturationBoost = Math.pow(saturation / 100, 1.3) * 2.5;
    } else {
      saturationBoost = 0.3;
    }

    const lightness = hsl.l;
    if (lightness >= 20 && lightness <= 80) {
      saturationBoost *= 1.8;
    }

    const repetitions = Math.max(1, Math.min(20, Math.round(saturationBoost)));

    for (let i = 0; i < repetitions; i++) {
      biased.push({ r: pixel.r, g: pixel.g, b: pixel.b });
    }
  }

  return biased;
}
