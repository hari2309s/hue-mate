import type { PixelData, PixelWithWeight, PixelWithOklab } from '../../../types/segmentation';
import { rgbToOklab, oklabToOklch, oklchToRgb } from '../conversion';
import { config } from '../../../config';

// Seeded random number generator (LCG algorithm)
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }
}

// Generate deterministic seed from pixel data
function generateSeed(pixels: PixelWithOklab[]): number {
  let hash = 0;
  const sampleSize = Math.min(100, pixels.length);
  const step = Math.floor(pixels.length / sampleSize);

  for (let i = 0; i < pixels.length; i += step) {
    const p = pixels[i];
    hash = ((hash << 5) - hash + Math.round(p.r * 255)) | 0;
    hash = ((hash << 5) - hash + Math.round(p.g * 255)) | 0;
    hash = ((hash << 5) - hash + Math.round(p.b * 255)) | 0;
  }

  return Math.abs(hash);
}

function kMeansPlusPlus(pixels: PixelWithOklab[], k: number, rng: SeededRandom): PixelWithOklab[] {
  const centroids: PixelWithOklab[] = [];

  // First centroid: pick deterministically from middle of array
  const firstIndex = Math.floor(pixels.length / 2);
  centroids.push({ ...pixels[firstIndex] });

  for (let i = 1; i < k; i++) {
    const distances = pixels.map((pixel) => {
      const minDist = Math.min(
        ...centroids.map((c) => {
          const dl = pixel.oklab.l - c.oklab.l;
          const da = pixel.oklab.a - c.oklab.a;
          const db = pixel.oklab.b - c.oklab.b;
          return Math.sqrt(dl * dl + da * da * 4 + db * db * 4);
        })
      );
      return minDist * minDist * minDist;
    });

    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let threshold = rng.next() * totalDist;

    for (let j = 0; j < pixels.length; j++) {
      threshold -= distances[j];
      if (threshold <= 0) {
        centroids.push({ ...pixels[j] });
        break;
      }
    }

    // Fallback if loop completes without selection
    if (centroids.length === i) {
      const fallbackIndex = rng.nextInt(0, pixels.length);
      centroids.push({ ...pixels[fallbackIndex] });
    }
  }

  return centroids;
}

export function kMeansClusteringOklab(
  pixels: PixelData[],
  k: number,
  maxIterations: number = config.extraction.clustering.maxIterations
): PixelWithWeight[] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels.map((p) => ({ ...p, weight: 1 / pixels.length }));

  // Convert to OKLab
  const oklabPixels: PixelWithOklab[] = pixels.map((p) => ({
    ...p,
    oklab: rgbToOklab(p.r, p.g, p.b),
  }));

  // Create deterministic RNG from pixel data
  const seed = generateSeed(oklabPixels);
  const rng = new SeededRandom(seed);

  // Initialize centroids deterministically
  let centroids = kMeansPlusPlus(oklabPixels, k, rng);
  let converged = false;
  let iteration = 0;

  while (!converged && iteration < maxIterations) {
    iteration++;

    // Assign pixels to nearest centroid
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

    // Compute new centroids
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
        Math.abs(c.oklab.l - newCentroids[i].oklab.l) <
          config.extraction.clustering.convergenceEpsilon &&
        Math.abs(c.oklab.a - newCentroids[i].oklab.a) <
          config.extraction.clustering.convergenceEpsilon &&
        Math.abs(c.oklab.b - newCentroids[i].oklab.b) <
          config.extraction.clustering.convergenceEpsilon
    );

    centroids = newCentroids;
  }

  // Calculate final cluster sizes
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

  return centroids
    .map((c, i) => ({
      r: c.r,
      g: c.g,
      b: c.b,
      weight: clusterSizes[i] / totalPixels,
    }))
    .sort((a, b) => b.weight - a.weight);
}
