import type { PixelWithWeight, OklabColor } from '@/types/segmentation';
import { rgbToOklab, rgbToHsl } from '@/core/color/conversion';
import type { HSLValues } from '@hue-und-you/types';
import { config } from '@hue-und-you/config';

interface ColorWithCache {
  r: number;
  g: number;
  b: number;
  weight: number;
  oklab: OklabColor;
  hsl: HSLValues;
  hash: number; // Spatial hash for quick neighbor finding
}

// Spatial hash for quick neighbor lookup
function computeSpatialHash(oklab: OklabColor): number {
  const gridSize = 10; // Divide color space into grid cells
  const lBucket = Math.floor(oklab.l * gridSize);
  const aBucket = Math.floor((oklab.a + 0.5) * gridSize);
  const bBucket = Math.floor((oklab.b + 0.5) * gridSize);
  return lBucket * 10000 + aBucket * 100 + bBucket;
}

// Get neighboring hashes for spatial queries
function getNeighborHashes(hash: number): number[] {
  const neighbors: number[] = [hash];
  const offsets = [-10000, -100, -1, 0, 1, 100, 10000];

  for (const offset of offsets) {
    neighbors.push(hash + offset);
  }

  return neighbors;
}

// Fast perceptual distance calculation
function fastPerceptualDistance(c1: ColorWithCache, c2: ColorWithCache): number {
  const dl = c1.oklab.l - c2.oklab.l;
  const da = c1.oklab.a - c2.oklab.a;
  const db = c1.oklab.b - c2.oklab.b;

  // Weighted OKLab distance (perceptually uniform)
  return Math.sqrt(dl * dl * 2 + da * da * 8 + db * db * 8);
}

// Check if colors are too similar in HSL space
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

  // Pre-compute all conversions and spatial hashes
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

  // Build spatial index for fast neighbor queries
  const spatialIndex = new Map<number, ColorWithCache[]>();
  for (const color of cached) {
    const bucket = spatialIndex.get(color.hash);
    if (bucket) {
      bucket.push(color);
    } else {
      spatialIndex.set(color.hash, [color]);
    }
  }

  // Track which colors to keep
  const keep = new Set<number>();
  const merged = new Map<number, number[]>(); // Track merges for weight accumulation

  keep.add(0); // Always keep first color
  merged.set(0, [0]);

  for (let i = 1; i < cached.length; i++) {
    const color = cached[i];
    let isTooSimilar = false;
    let mergeTarget = -1;

    // Get colors in neighboring spatial buckets
    const neighborHashes = getNeighborHashes(color.hash);
    const candidates: ColorWithCache[] = [];

    for (const hash of neighborHashes) {
      const bucket = spatialIndex.get(hash);
      if (bucket) {
        candidates.push(...bucket);
      }
    }

    // Check only against candidates in nearby spatial regions
    for (let j = 0; j < candidates.length; j++) {
      const candidate = candidates[j];
      const candidateIndex = cached.indexOf(candidate);

      // Skip if not in keep set or is current color
      if (!keep.has(candidateIndex) || candidateIndex === i) continue;

      // Fast HSL similarity check first
      if (areSimilarInHSL(color, candidate)) {
        isTooSimilar = true;
        mergeTarget = candidateIndex;
        break;
      }

      // Perceptual distance check
      const distance = fastPerceptualDistance(color, candidate);

      // Adaptive threshold based on neutrality
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
      // Accumulate weight to merge target
      const mergeList = merged.get(mergeTarget) || [];
      mergeList.push(i);
      merged.set(mergeTarget, mergeList);
    }
  }

  // Build result with accumulated weights
  const result: PixelWithWeight[] = [];

  for (const idx of Array.from(keep).sort((a, b) => a - b)) {
    const color = cached[idx];
    const mergeList = merged.get(idx) || [idx];

    // Sum weights of all merged colors
    const totalWeight = mergeList.reduce((sum, i) => sum + cached[i].weight, 0);

    result.push({
      r: color.r,
      g: color.g,
      b: color.b,
      weight: totalWeight,
    });
  }

  // Sort by weight (descending)
  result.sort((a, b) => b.weight - a.weight);

  return result;
}

// Optimized final cleanup pass
export function finalCleanup(colors: PixelWithWeight[]): PixelWithWeight[] {
  if (colors.length <= 1) return colors;

  // Use same spatial indexing approach
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

      // Very tight HSL similarity check
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
