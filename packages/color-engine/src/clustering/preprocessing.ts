import type { PixelData, PixelWithWeight } from '@hue-und-you/types';
import { rgbToHsl, rgbToOklab } from '@/conversion';
import { config } from '@hue-und-you/config';

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

interface ColorWithCache {
  r: number;
  g: number;
  b: number;
  weight: number;
  oklab: ReturnType<typeof rgbToOklab>;
  hsl: ReturnType<typeof rgbToHsl>;
  hash: number;
}

function computeSpatialHash(oklab: ReturnType<typeof rgbToOklab>): number {
  const gridSize = 10;
  const lBucket = Math.floor(oklab.l * gridSize);
  const aBucket = Math.floor((oklab.a + 0.5) * gridSize);
  const bBucket = Math.floor((oklab.b + 0.5) * gridSize);
  return lBucket * 10000 + aBucket * 100 + bBucket;
}

function getNeighborHashes(hash: number): number[] {
  const neighbors: number[] = [hash];
  const offsets = [-10000, -100, -1, 0, 1, 100, 10000];

  for (const offset of offsets) {
    neighbors.push(hash + offset);
  }

  return neighbors;
}

function fastPerceptualDistance(c1: ColorWithCache, c2: ColorWithCache): number {
  const dl = c1.oklab.l - c2.oklab.l;
  const da = c1.oklab.a - c2.oklab.a;
  const db = c1.oklab.b - c2.oklab.b;
  return Math.sqrt(dl * dl * 2 + da * da * 8 + db * db * 8);
}

function areSimilarInHSL(c1: ColorWithCache, c2: ColorWithCache): boolean {
  let hueDiff = Math.abs(c1.hsl.h - c2.hsl.h);
  if (hueDiff > 180) hueDiff = 360 - hueDiff;

  const satDiff = Math.abs(c1.hsl.s - c2.hsl.s);
  const lumDiff = Math.abs(c1.hsl.l - c2.hsl.l);

  const isNeutral = c1.hsl.s < 20 || c2.hsl.s < 20;
  const isVeryNeutral = c1.hsl.s < 10 || c2.hsl.s < 10;

  if (isVeryNeutral && lumDiff < 22) return true;
  if (isNeutral && lumDiff < 15 && satDiff < 20) return true;
  if (hueDiff < 32 && satDiff < 25 && lumDiff < 20) return true;

  return false;
}

export function deduplicateSimilarColors(
  colors: PixelWithWeight[],
  minDistance: number = config.extraction.clustering.deduplicationThreshold
): PixelWithWeight[] {
  if (colors.length === 0) return [];
  if (colors.length === 1) return colors;

  const cached: ColorWithCache[] = colors.map((c) => {
    const oklab = rgbToOklab(c.r, c.g, c.b);
    return {
      r: c.r,
      g: c.g,
      b: c.b,
      weight: c.weight,
      oklab,
      hsl: rgbToHsl(c.r, c.g, c.b),
      hash: computeSpatialHash(oklab),
    };
  });

  const spatialIndex = new Map<number, ColorWithCache[]>();
  for (const color of cached) {
    const bucket = spatialIndex.get(color.hash);
    if (bucket) {
      bucket.push(color);
    } else {
      spatialIndex.set(color.hash, [color]);
    }
  }
  const keep = new Set<number>();
  const merged = new Map<number, number[]>();
  keep.add(0);
  merged.set(0, [0]);
  for (let i = 1; i < cached.length; i++) {
    const color = cached[i];
    let isTooSimilar = false;
    let mergeTarget = -1;
    const neighborHashes = getNeighborHashes(color.hash);
    const candidates: ColorWithCache[] = [];

    for (const hash of neighborHashes) {
      const bucket = spatialIndex.get(hash);
      if (bucket) {
        candidates.push(...bucket);
      }
    }

    for (let j = 0; j < candidates.length; j++) {
      const candidate = candidates[j];
      const candidateIndex = cached.indexOf(candidate);

      if (!keep.has(candidateIndex) || candidateIndex === i) continue;

      if (areSimilarInHSL(color, candidate)) {
        isTooSimilar = true;
        mergeTarget = candidateIndex;
        break;
      }

      const distance = fastPerceptualDistance(color, candidate);

      const isNeutral = color.hsl.s < 20 || candidate.hsl.s < 20;
      const isVeryNeutral = color.hsl.s < 10 || candidate.hsl.s < 10;

      let effectiveThreshold = minDistance;
      if (isVeryNeutral) {
        effectiveThreshold = minDistance * 0.7;
      } else if (isNeutral) {
        effectiveThreshold = minDistance * 0.85;
      }

      if (distance < effectiveThreshold) {
        isTooSimilar = true;
        mergeTarget = candidateIndex;
        break;
      }
    }

    if (!isTooSimilar) {
      keep.add(i);
      merged.set(i, [i]);
    } else if (mergeTarget >= 0) {
      const mergeList = merged.get(mergeTarget) || [];
      mergeList.push(i);
      merged.set(mergeTarget, mergeList);
    }
  }
  const result: PixelWithWeight[] = [];
  for (const idx of Array.from(keep).sort((a, b) => a - b)) {
    const color = cached[idx];
    const mergeList = merged.get(idx) || [idx];
    const totalWeight = mergeList.reduce((sum, i) => sum + cached[i].weight, 0);

    result.push({
      r: color.r,
      g: color.g,
      b: color.b,
      weight: totalWeight,
    });
  }
  result.sort((a, b) => b.weight - a.weight);
  return result;
}
export function finalCleanup(colors: PixelWithWeight[]): PixelWithWeight[] {
  if (colors.length <= 1) return colors;
  const cached: ColorWithCache[] = colors.map((c) => {
    const oklab = rgbToOklab(c.r, c.g, c.b);
    return {
      r: c.r,
      g: c.g,
      b: c.b,
      weight: c.weight,
      oklab,
      hsl: rgbToHsl(c.r, c.g, c.b),
      hash: computeSpatialHash(oklab),
    };
  });
  const spatialIndex = new Map<number, ColorWithCache[]>();
  for (const color of cached) {
    const bucket = spatialIndex.get(color.hash);
    if (bucket) {
      bucket.push(color);
    } else {
      spatialIndex.set(color.hash, [color]);
    }
  }
  const keep = new Set<number>();
  const weights = new Map<number, number>();
  keep.add(0);
  weights.set(0, cached[0].weight);
  for (let i = 1; i < cached.length; i++) {
    const color = cached[i];
    let shouldKeep = true;
    let mergeTarget = -1;
    const neighborHashes = getNeighborHashes(color.hash);
    const candidates: ColorWithCache[] = [];

    for (const hash of neighborHashes) {
      const bucket = spatialIndex.get(hash);
      if (bucket) candidates.push(...bucket);
    }

    for (const candidate of candidates) {
      const candidateIndex = cached.indexOf(candidate);
      if (!keep.has(candidateIndex) || candidateIndex === i) continue;

      const distance = fastPerceptualDistance(color, candidate);
      if (distance < config.extraction.clustering.perceptualDistanceThreshold) {
        shouldKeep = false;
        mergeTarget = candidateIndex;
        break;
      }

      let hueDiff = Math.abs(color.hsl.h - candidate.hsl.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;
      const satDiff = Math.abs(color.hsl.s - candidate.hsl.s);
      const lumDiff = Math.abs(color.hsl.l - candidate.hsl.l);

      if (hueDiff < 12 && satDiff < 12 && lumDiff < 12) {
        shouldKeep = false;
        mergeTarget = candidateIndex;
        break;
      }
    }

    if (shouldKeep) {
      keep.add(i);
      weights.set(i, color.weight);
    } else if (mergeTarget >= 0) {
      weights.set(mergeTarget, (weights.get(mergeTarget) || 0) + color.weight);
    }
  }
  const result: PixelWithWeight[] = [];
  for (const idx of keep) {
    const color = cached[idx];
    result.push({
      r: color.r,
      g: color.g,
      b: color.b,
      weight: weights.get(idx) || color.weight,
    });
  }
  result.sort((a, b) => b.weight - a.weight);
  return result;
}
