import type { PixelWithWeight } from '@hute-mate/types';
import { rgbToHsl } from '@/conversion';
import { config } from '@hute-mate/config';

export function enforceHueDiversity(
  colors: PixelWithWeight[],
  minHueDifference: number = config.extraction.clustering.minHueDifference
): PixelWithWeight[] {
  if (colors.length === 0) return [];

  const diverse: PixelWithWeight[] = [colors[0]];

  for (let i = 1; i < colors.length; i++) {
    const color = colors[i];
    const hsl = rgbToHsl(color.r, color.g, color.b);

    if (hsl.s < 15) {
      let hasSimilarNeutral = false;

      for (const existing of diverse) {
        const existingHsl = rgbToHsl(existing.r, existing.g, existing.b);

        if (existingHsl.s < 15) {
          const lumDiff = Math.abs(hsl.l - existingHsl.l);

          if (lumDiff < 25) {
            hasSimilarNeutral = true;
            break;
          }
        }
      }

      if (!hasSimilarNeutral) {
        diverse.push(color);
      }
      continue;
    }

    let hueTooSimilar = false;

    for (const existing of diverse) {
      const existingHsl = rgbToHsl(existing.r, existing.g, existing.b);

      if (existingHsl.s < 15) continue;

      let hueDiff = Math.abs(hsl.h - existingHsl.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;

      const satDiff = Math.abs(hsl.s - existingHsl.s);
      const lumDiff = Math.abs(hsl.l - existingHsl.l);

      if (hueDiff < minHueDifference && satDiff < 20) {
        hueTooSimilar = true;
        break;
      }

      if (hueDiff < 18 && satDiff < 25 && lumDiff < 22) {
        hueTooSimilar = true;
        break;
      }

      if (hueDiff < 25 && satDiff < 15) {
        hueTooSimilar = true;
        break;
      }
    }

    if (!hueTooSimilar) {
      diverse.push(color);
    }
  }

  return diverse;
}
