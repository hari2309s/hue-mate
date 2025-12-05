import type { PixelData } from '@/types/segmentation';
import { rgbToHsl } from '@/core/color/conversion';
import { config } from '@/config';

export function applySaturationBias(pixels: PixelData[]): PixelData[] {
  const biased: PixelData[] = [];

  for (const pixel of pixels) {
    const hsl = rgbToHsl(pixel.r, pixel.g, pixel.b);
    const saturation = hsl.s;

    let saturationBoost = config.extraction.saturation.neutralBoost;

    if (saturation > config.extraction.saturation.highThreshold) {
      saturationBoost =
        Math.pow(saturation / 100, config.extraction.saturation.highPower) *
        config.extraction.saturation.highBoost;
    } else if (saturation > config.extraction.saturation.mediumThreshold) {
      saturationBoost =
        Math.pow(saturation / 100, config.extraction.saturation.mediumPower) *
        config.extraction.saturation.mediumBoost;
    } else if (saturation > config.extraction.saturation.lowThreshold) {
      saturationBoost =
        Math.pow(saturation / 100, config.extraction.saturation.lowPower) *
        config.extraction.saturation.lowBoost;
    }

    const lightness = hsl.l;
    if (
      lightness >= config.extraction.saturation.optimalLightnessMin &&
      lightness <= config.extraction.saturation.optimalLightnessMax
    ) {
      saturationBoost *= config.extraction.saturation.lightnessBoost;
    }

    const repetitions = Math.max(1, Math.min(20, Math.round(saturationBoost)));

    for (let i = 0; i < repetitions; i++) {
      biased.push({ r: pixel.r, g: pixel.g, b: pixel.b });
    }
  }

  return biased;
}
