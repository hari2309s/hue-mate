import type { PixelData, PixelWithWeight, PixelWithOklab } from '../types/segmentation';
import { rgbToOklab, oklabToOklch, oklchToRgb } from './colorConversion';

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
