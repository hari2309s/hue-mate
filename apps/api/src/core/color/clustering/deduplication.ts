import type { PixelWithWeight, OklabColor } from '../../../types/segmentation';
import { rgbToOklab, rgbToHsl } from '../conversion';
import type { HSLValues } from '@hue-und-you/types';
import { config } from '../../../config';

interface ColorWithCache {
  r: number;
  g: number;
  b: number;
  weight: number;
  oklab: OklabColor;
  hsl: HSLValues;
}

export function deduplicateSimilarColors(
  colors: PixelWithWeight[],
  minDistance: number = config.extraction.clustering.deduplicationThreshold
): PixelWithWeight[] {
  if (colors.length === 0) return [];

  // Pre-compute all conversions (optimization fix #6)
  const cached: ColorWithCache[] = colors.map((c) => ({
    ...c,
    oklab: rgbToOklab(c.r, c.g, c.b),
    hsl: rgbToHsl(c.r, c.g, c.b),
  }));

  const unique: ColorWithCache[] = [cached[0]];

  for (let i = 1; i < cached.length; i++) {
    const color = cached[i];
    let isTooSimilar = false;
    let closestIndex = -1;
    let minDist = Infinity;

    for (let j = 0; j < unique.length; j++) {
      const existing = unique[j];

      const dl = color.oklab.l - existing.oklab.l;
      const da = color.oklab.a - existing.oklab.a;
      const db = color.oklab.b - existing.oklab.b;

      const perceptualDist = Math.sqrt(dl * dl * 2 + da * da * 8 + db * db * 8);

      let hueDiff = Math.abs(color.hsl.h - existing.hsl.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;

      const satDiff = Math.abs(color.hsl.s - existing.hsl.s);
      const lumDiff = Math.abs(color.hsl.l - existing.hsl.l);

      const isNeutral = color.hsl.s < 20 || existing.hsl.s < 20;
      const isVeryNeutral = color.hsl.s < 10 || existing.hsl.s < 10;

      let effectiveThreshold = minDistance;

      if (isVeryNeutral) {
        if (lumDiff < 22) {
          isTooSimilar = true;
          closestIndex = j;
          break;
        }
        effectiveThreshold = minDistance * 0.7;
      } else if (isNeutral) {
        if (lumDiff < 15 && satDiff < 20) {
          isTooSimilar = true;
          closestIndex = j;
          break;
        }
        effectiveThreshold = minDistance * 0.85;
      } else {
        if (hueDiff < 32 && satDiff < 25 && lumDiff < 20) {
          isTooSimilar = true;
          closestIndex = j;
          break;
        }
      }

      if (perceptualDist < minDist) {
        minDist = perceptualDist;
        closestIndex = j;
      }

      if (perceptualDist < effectiveThreshold) {
        isTooSimilar = true;
        break;
      }
    }

    if (!isTooSimilar) {
      unique.push(color);
    } else if (closestIndex >= 0) {
      unique[closestIndex].weight += color.weight;
    }
  }

  return unique
    .map(({ r, g, b, weight }) => ({ r, g, b, weight }))
    .sort((a, b) => b.weight - a.weight);
}

export function finalCleanup(colors: PixelWithWeight[]): PixelWithWeight[] {
  if (colors.length <= 1) return colors;

  // Pre-compute conversions
  const cached: ColorWithCache[] = colors.map((c) => ({
    ...c,
    oklab: rgbToOklab(c.r, c.g, c.b),
    hsl: rgbToHsl(c.r, c.g, c.b),
  }));

  const cleaned: ColorWithCache[] = [cached[0]];

  for (let i = 1; i < cached.length; i++) {
    const color = cached[i];
    let keepColor = true;
    let mergeIndex = -1;

    for (let j = 0; j < cleaned.length; j++) {
      const existing = cleaned[j];

      const dl = color.oklab.l - existing.oklab.l;
      const da = color.oklab.a - existing.oklab.a;
      const db = color.oklab.b - existing.oklab.b;
      const dist = Math.sqrt(dl * dl * 2 + da * da * 8 + db * db * 8);

      if (dist < config.extraction.clustering.perceptualDistanceThreshold) {
        keepColor = false;
        mergeIndex = j;
        break;
      }

      let hueDiff = Math.abs(color.hsl.h - existing.hsl.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;
      const satDiff = Math.abs(color.hsl.s - existing.hsl.s);
      const lumDiff = Math.abs(color.hsl.l - existing.hsl.l);

      if (hueDiff < 12 && satDiff < 12 && lumDiff < 12) {
        keepColor = false;
        mergeIndex = j;
        break;
      }
    }

    if (keepColor) {
      cleaned.push(color);
    } else if (mergeIndex >= 0) {
      cleaned[mergeIndex].weight += color.weight;
    }
  }

  return cleaned
    .map(({ r, g, b, weight }) => ({ r, g, b, weight }))
    .sort((a, b) => b.weight - a.weight);
}
