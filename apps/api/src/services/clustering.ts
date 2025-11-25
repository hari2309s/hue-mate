import type { PixelData, PixelWithWeight, PixelWithOklab } from '../types/segmentation';
import { rgbToOklab, oklabToOklch, oklchToRgb, rgbToHsl } from './colorConversion';

// ============================================
// K-MEANS++ INITIALIZATION
// ============================================

function kMeansPlusPlus(pixels: PixelWithOklab[], k: number): PixelWithOklab[] {
  const centroids: PixelWithOklab[] = [];

  // First centroid: random
  centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });

  // Remaining centroids: weighted by distance
  for (let i = 1; i < k; i++) {
    const distances = pixels.map((pixel) => {
      const minDist = Math.min(
        ...centroids.map((c) => {
          const dl = pixel.oklab.l - c.oklab.l;
          const da = pixel.oklab.a - c.oklab.a;
          const db = pixel.oklab.b - c.oklab.b;
          return Math.sqrt(dl * dl + da * da + db * db);
        })
      );
      return minDist * minDist;
    });

    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let threshold = Math.random() * totalDist;

    for (let j = 0; j < pixels.length; j++) {
      threshold -= distances[j];
      if (threshold <= 0) {
        centroids.push({ ...pixels[j] });
        break;
      }
    }
  }

  return centroids;
}

// ============================================
// SATURATION BOOSTING
// ============================================

/**
 * Apply aggressive saturation bias to ensure vibrant colors are captured
 * High saturation colors get much higher weight in clustering
 */
export function applySaturationBias(pixels: PixelData[]): PixelData[] {
  const biased: PixelData[] = [];

  for (const pixel of pixels) {
    const hsl = rgbToHsl(pixel.r, pixel.g, pixel.b);
    const saturation = hsl.s; // 0-100

    // Calculate boost factor based on saturation
    // Ultra-saturated (>75%): 5x weight
    // Very saturated (50-75%): 3x weight
    // Moderately saturated (25-50%): 1.5x weight
    // Low saturation (<25%): 1x weight (no boost)
    let saturationBoost = 1;

    if (saturation > 75) {
      // Highly vibrant colors - give them strong presence
      saturationBoost = Math.pow(saturation / 100, 2.2) * 5;
    } else if (saturation > 50) {
      // Very saturated - boost them
      saturationBoost = Math.pow(saturation / 100, 2.0) * 3;
    } else if (saturation > 25) {
      // Moderately saturated - slight boost
      saturationBoost = Math.pow(saturation / 100, 1.5) * 1.5;
    } else {
      // Low saturation (mostly grays/neutrals) - keep neutral weight
      saturationBoost = 1;
    }

    // Additionally boost pixels that are neither too dark nor too bright
    // (middle tones tend to be more visually important)
    const lightness = hsl.l; // 0-100
    if (lightness >= 20 && lightness <= 80) {
      saturationBoost *= 1.2; // 20% boost for mid-tone colors
    }

    // Ensure minimum 1 repetition, maximum reasonable limit
    const repetitions = Math.max(1, Math.min(10, Math.round(saturationBoost)));

    // Add pixel multiple times based on boost
    for (let i = 0; i < repetitions; i++) {
      biased.push({ r: pixel.r, g: pixel.g, b: pixel.b });
    }
  }

  return biased;
}

// ============================================
// K-MEANS CLUSTERING IN OKLAB SPACE
// ============================================

export function kMeansClusteringOklab(
  pixels: PixelData[],
  k: number,
  maxIterations: number = 100
): PixelWithWeight[] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels.map((p) => ({ ...p, weight: 1 / pixels.length }));

  // Convert to OKLAB
  const oklabPixels: PixelWithOklab[] = pixels.map((p) => ({
    ...p,
    oklab: rgbToOklab(p.r, p.g, p.b),
  }));

  // Initialize centroids with k-means++
  let centroids = kMeansPlusPlus(oklabPixels, k);
  let converged = false;
  let iteration = 0;

  while (!converged && iteration < maxIterations) {
    iteration++;

    // Assign pixels to clusters
    const clusters: PixelWithOklab[][] = Array.from({ length: k }, () => []);

    for (const pixel of oklabPixels) {
      let minDist = Infinity;
      let closest = 0;

      for (let i = 0; i < k; i++) {
        const dl = pixel.oklab.l - centroids[i].oklab.l;
        const da = pixel.oklab.a - centroids[i].oklab.a;
        const db = pixel.oklab.b - centroids[i].oklab.b;
        const dist = Math.sqrt(dl * dl + da * da + db * db);

        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      clusters[closest].push(pixel);
    }

    // Update centroids
    const newCentroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];

      const avgOklab = {
        l: cluster.reduce((sum, p) => sum + p.oklab.l, 0) / cluster.length,
        a: cluster.reduce((sum, p) => sum + p.oklab.a, 0) / cluster.length,
        b: cluster.reduce((sum, p) => sum + p.oklab.b, 0) / cluster.length,
      };

      const oklch = oklabToOklch(avgOklab);
      const rgb = oklchToRgb(oklch);

      return { ...rgb, oklab: avgOklab };
    });

    // Check convergence
    converged = centroids.every(
      (c, i) =>
        Math.abs(c.oklab.l - newCentroids[i].oklab.l) < 0.0001 &&
        Math.abs(c.oklab.a - newCentroids[i].oklab.a) < 0.0001 &&
        Math.abs(c.oklab.b - newCentroids[i].oklab.b) < 0.0001
    );

    centroids = newCentroids;
  }

  // Calculate cluster sizes for weights
  const clusterSizes = centroids.map((_, i) => {
    return oklabPixels.filter((pixel) => {
      let minDist = Infinity;
      let closest = 0;

      for (let j = 0; j < centroids.length; j++) {
        const dl = pixel.oklab.l - centroids[j].oklab.l;
        const da = pixel.oklab.a - centroids[j].oklab.a;
        const db = pixel.oklab.b - centroids[j].oklab.b;
        const dist = Math.sqrt(dl * dl + da * da + db * db);

        if (dist < minDist) {
          minDist = dist;
          closest = j;
        }
      }
      return closest === i;
    }).length;
  });

  const totalPixels = pixels.length;

  // Return sorted by weight (most dominant first)
  return centroids
    .map((c, i) => ({
      r: c.r,
      g: c.g,
      b: c.b,
      weight: clusterSizes[i] / totalPixels,
    }))
    .sort((a, b) => b.weight - a.weight);
}
