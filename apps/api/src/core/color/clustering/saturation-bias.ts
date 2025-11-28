import type { PixelData } from '../../../types/segmentation';
import { rgbToHsl } from '../conversion';
import { SATURATION_CONFIG } from '../../../config';

export function applySaturationBias(pixels: PixelData[]): PixelData[] {
  const biased: PixelData[] = [];

  for (const pixel of pixels) {
    const hsl = rgbToHsl(pixel.r, pixel.g, pixel.b);
    const saturation = hsl.s;

    let saturationBoost = SATURATION_CONFIG.NEUTRAL_BOOST;

    if (saturation > SATURATION_CONFIG.HIGH_THRESHOLD) {
      saturationBoost =
        Math.pow(saturation / 100, SATURATION_CONFIG.HIGH_POWER) * SATURATION_CONFIG.HIGH_BOOST;
    } else if (saturation > SATURATION_CONFIG.MEDIUM_THRESHOLD) {
      saturationBoost =
        Math.pow(saturation / 100, SATURATION_CONFIG.MEDIUM_POWER) * SATURATION_CONFIG.MEDIUM_BOOST;
    } else if (saturation > SATURATION_CONFIG.LOW_THRESHOLD) {
      saturationBoost =
        Math.pow(saturation / 100, SATURATION_CONFIG.LOW_POWER) * SATURATION_CONFIG.LOW_BOOST;
    }

    const lightness = hsl.l;
    if (
      lightness >= SATURATION_CONFIG.OPTIMAL_LIGHTNESS_MIN &&
      lightness <= SATURATION_CONFIG.OPTIMAL_LIGHTNESS_MAX
    ) {
      saturationBoost *= SATURATION_CONFIG.LIGHTNESS_BOOST;
    }

    const repetitions = Math.max(1, Math.min(20, Math.round(saturationBoost)));

    for (let i = 0; i < repetitions; i++) {
      biased.push({ r: pixel.r, g: pixel.g, b: pixel.b });
    }
  }

  return biased;
}
