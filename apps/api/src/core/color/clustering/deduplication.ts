import type { PixelWithWeight } from '../../../types/segmentation';
import { rgbToOklab, rgbToHsl } from '../conversion';

export function deduplicateSimilarColors(
  colors: PixelWithWeight[],
  minDistance: number = 0.5
): PixelWithWeight[] {
  if (colors.length === 0) return [];

  const unique: PixelWithWeight[] = [colors[0]];

  for (let i = 1; i < colors.length; i++) {
    const color = colors[i];
    const oklab = rgbToOklab(color.r, color.g, color.b);
    const hsl = rgbToHsl(color.r, color.g, color.b);

    let isTooSimilar = false;
    let closestIndex = -1;
    let minDist = Infinity;

    for (let j = 0; j < unique.length; j++) {
      const existingOklab = rgbToOklab(unique[j].r, unique[j].g, unique[j].b);
      const existingHsl = rgbToHsl(unique[j].r, unique[j].g, unique[j].b);

      const dl = oklab.l - existingOklab.l;
      const da = oklab.a - existingOklab.a;
      const db = oklab.b - existingOklab.b;

      const perceptualDist = Math.sqrt(dl * dl * 2 + da * da * 8 + db * db * 8);

      let hueDiff = Math.abs(hsl.h - existingHsl.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;

      const satDiff = Math.abs(hsl.s - existingHsl.s);
      const lumDiff = Math.abs(hsl.l - existingHsl.l);

      const isNeutral = hsl.s < 20 || existingHsl.s < 20;
      const isVeryNeutral = hsl.s < 10 || existingHsl.s < 10;

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

  return unique.sort((a, b) => b.weight - a.weight);
}

export function finalCleanup(colors: PixelWithWeight[]): PixelWithWeight[] {
  if (colors.length <= 1) return colors;

  const cleaned: PixelWithWeight[] = [colors[0]];

  for (let i = 1; i < colors.length; i++) {
    const color = colors[i];
    const oklab = rgbToOklab(color.r, color.g, color.b);
    const hsl = rgbToHsl(color.r, color.g, color.b);

    let keepColor = true;
    let mergeIndex = -1;

    for (let j = 0; j < cleaned.length; j++) {
      const existing = cleaned[j];
      const existingOklab = rgbToOklab(existing.r, existing.g, existing.b);
      const existingHsl = rgbToHsl(existing.r, existing.g, existing.b);

      const dl = oklab.l - existingOklab.l;
      const da = oklab.a - existingOklab.a;
      const db = oklab.b - existingOklab.b;
      const dist = Math.sqrt(dl * dl * 2 + da * da * 8 + db * db * 8);

      if (dist < 0.35) {
        keepColor = false;
        mergeIndex = j;
        break;
      }

      let hueDiff = Math.abs(hsl.h - existingHsl.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;
      const satDiff = Math.abs(hsl.s - existingHsl.s);
      const lumDiff = Math.abs(hsl.l - existingHsl.l);

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

  return cleaned.sort((a, b) => b.weight - a.weight);
}
