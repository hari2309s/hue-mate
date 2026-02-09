import type { PixelData, PixelWithWeight, PixelWithOklab } from '@hute-mate/types';
import { rgbToOklab, oklabToOklch, oklchToRgb } from '@/conversion';
import { config } from '@hute-mate/config';

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}

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

function calculateDistance(
  l1: number,
  a1: number,
  b1: number,
  l2: number,
  a2: number,
  b2: number
): number {
  const dl = l1 - l2;
  const da = a1 - a2;
  const db = b1 - b2;
  return Math.sqrt(dl * dl + da * da + db * db);
}

function kMeansPlusPlus(pixels: PixelWithOklab[], k: number, rng: SeededRandom): PixelWithOklab[] {
  const centroids: PixelWithOklab[] = [];
  const n = pixels.length;
  const distances = new Float32Array(n);

  const firstIndex = Math.floor(n / 2);
  centroids.push({ ...pixels[firstIndex] });

  for (let i = 1; i < k; i++) {
    let totalDist = 0;

    for (let j = 0; j < n; j++) {
      const pixel = pixels[j];
      let minDist = Infinity;

      for (const c of centroids) {
        const dist = calculateDistance(
          pixel.oklab.l,
          pixel.oklab.a,
          pixel.oklab.b,
          c.oklab.l,
          c.oklab.a,
          c.oklab.b
        );
        if (dist < minDist) minDist = dist;
      }

      const weightedDist = minDist * minDist * minDist;
      distances[j] = weightedDist;
      totalDist += weightedDist;
    }

    let threshold = rng.next() * totalDist;
    let selectedIndex = 0;

    for (let j = 0; j < n; j++) {
      threshold -= distances[j];
      if (threshold <= 0) {
        selectedIndex = j;
        break;
      }
    }

    centroids.push({ ...pixels[selectedIndex] });
  }

  return centroids;
}

export function kMeansClusteringOklab(
  pixels: PixelData[],
  k: number,
  maxIterations: number = config.extraction.clustering.maxIterations
): PixelWithWeight[] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) {
    return pixels.map((p) => ({ ...p, weight: 1 / pixels.length }));
  }

  const n = pixels.length;

  const oklabPixels: PixelWithOklab[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = pixels[i];
    oklabPixels[i] = {
      r: p.r,
      g: p.g,
      b: p.b,
      oklab: rgbToOklab(p.r, p.g, p.b),
    };
  }

  const seed = generateSeed(oklabPixels);
  const rng = new SeededRandom(seed);

  let centroids = kMeansPlusPlus(oklabPixels, k, rng);

  const assignments = new Uint16Array(n);
  const clusterSizes = new Uint32Array(k);

  let converged = false;
  let iteration = 0;
  let lastChange = Infinity;

  while (!converged && iteration < maxIterations) {
    iteration++;
    clusterSizes.fill(0);

    let changes = 0;
    for (let i = 0; i < n; i++) {
      const pixel = oklabPixels[i];
      let minDist = Infinity;
      let closest = 0;

      for (let j = 0; j < k; j++) {
        const dist = calculateDistance(
          pixel.oklab.l,
          pixel.oklab.a,
          pixel.oklab.b,
          centroids[j].oklab.l,
          centroids[j].oklab.a,
          centroids[j].oklab.b
        );

        if (dist < minDist) {
          minDist = dist;
          closest = j;
        }
      }

      if (assignments[i] !== closest) {
        changes++;
        assignments[i] = closest;
      }
      clusterSizes[closest]++;
    }

    if (changes < n * 0.001) {
      converged = true;
      break;
    }

    if (changes >= lastChange * 0.99) {
      converged = true;
      break;
    }
    lastChange = changes;

    const sumL = new Float64Array(k);
    const sumA = new Float64Array(k);
    const sumB = new Float64Array(k);

    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      const pixel = oklabPixels[i];
      sumL[cluster] += pixel.oklab.l;
      sumA[cluster] += pixel.oklab.a;
      sumB[cluster] += pixel.oklab.b;
    }

    let maxCentroidShift = 0;
    for (let j = 0; j < k; j++) {
      if (clusterSizes[j] === 0) continue;

      const count = clusterSizes[j];
      const newL = sumL[j] / count;
      const newA = sumA[j] / count;
      const newB = sumB[j] / count;

      const shift =
        Math.abs(newL - centroids[j].oklab.l) +
        Math.abs(newA - centroids[j].oklab.a) +
        Math.abs(newB - centroids[j].oklab.b);

      if (shift > maxCentroidShift) {
        maxCentroidShift = shift;
      }

      const oklch = oklabToOklch({ l: newL, a: newA, b: newB });
      const rgb = oklchToRgb(oklch);

      centroids[j] = {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        oklab: { l: newL, a: newA, b: newB },
      };
    }

    if (maxCentroidShift < config.extraction.clustering.convergenceEpsilon) {
      converged = true;
    }
  }

  const totalPixels = pixels.length;
  const result: PixelWithWeight[] = [];

  for (let j = 0; j < k; j++) {
    const size = clusterSizes[j];
    if (size > 0) {
      result.push({
        r: centroids[j].r,
        g: centroids[j].g,
        b: centroids[j].b,
        weight: size / totalPixels,
      });
    }
  }

  result.sort((a, b) => b.weight - a.weight);

  return result;
}
