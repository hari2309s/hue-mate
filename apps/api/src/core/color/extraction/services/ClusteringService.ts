import { logger } from '@/utils';
import {
  applySaturationBias,
  kMeansClusteringOklab,
  deduplicateSimilarColors,
  enforceHueDiversity,
  finalCleanup,
} from '@/core/color/clustering';
import { rgbToOklab } from '@/core/color/conversion';
import type { PixelData } from '@/types/segmentation';
import type {
  IClusteringService,
  ClusteringResult,
  ClusteringOptions,
} from '@/core/color/extraction/types';

export class ClusteringService implements IClusteringService {
  async cluster(
    fgPixels: PixelData[],
    bgPixels: PixelData[],
    options?: ClusteringOptions
  ): Promise<ClusteringResult> {
    logger.info('🔬 Clustering service: Starting...');

    const optimalCount = this.determineOptimalColorCount(fgPixels, bgPixels, options?.numColors);

    const fgRatio = fgPixels.length / (fgPixels.length + bgPixels.length);
    const fgColorCount = Math.max(2, Math.round(optimalCount * Math.max(0.3, fgRatio)));
    const bgColorCount = Math.max(2, optimalCount - fgColorCount);

    logger.info(`Distributing colors: ${fgColorCount} FG + ${bgColorCount} BG`);

    // Apply bias and cluster
    const biasedFgPixels = applySaturationBias(fgPixels);
    const biasedBgPixels = applySaturationBias(bgPixels);

    const rawFgColors =
      biasedFgPixels.length > 0 ? kMeansClusteringOklab(biasedFgPixels, fgColorCount * 4) : [];
    const rawBgColors =
      biasedBgPixels.length > 0 ? kMeansClusteringOklab(biasedBgPixels, bgColorCount * 4) : [];

    // Cleanup pipeline
    const dedupedFg = deduplicateSimilarColors(rawFgColors, 0.35);
    const dedupedBg = deduplicateSimilarColors(rawBgColors, 0.35);

    const diverseFg = enforceHueDiversity(dedupedFg, 35);
    const diverseBg = enforceHueDiversity(dedupedBg, 35);

    const slicedFg = diverseFg.slice(0, fgColorCount);
    const slicedBg = diverseBg.slice(0, bgColorCount);

    let dominantFgColors = finalCleanup(slicedFg);
    let dominantBgColors = finalCleanup(slicedBg);

    // Ensure minimum colors
    dominantFgColors = this.ensureMinimumColors(dominantFgColors, diverseFg, fgColorCount, 2);
    dominantBgColors = this.ensureMinimumColors(dominantBgColors, diverseBg, bgColorCount, 2);

    logger.success(
      `✓ Clustering complete: ${dominantFgColors.length} FG + ${dominantBgColors.length} BG`
    );

    return { dominantFgColors, dominantBgColors };
  }

  private determineOptimalColorCount(
    fgPixels: PixelData[],
    bgPixels: PixelData[],
    requestedCount?: number
  ): number {
    if (requestedCount) return requestedCount;

    const totalPixels = fgPixels.length + bgPixels.length;
    const sampleSize = Math.min(500, totalPixels);
    const step = Math.floor(totalPixels / sampleSize);
    const samples: PixelData[] = [];

    for (let i = 0; i < fgPixels.length; i += step) {
      samples.push(fgPixels[i]);
    }
    for (let i = 0; i < bgPixels.length; i += step) {
      samples.push(bgPixels[i]);
    }

    const oklabSamples = samples.map((p) => rgbToOklab(p.r, p.g, p.b));
    let sumL = 0,
      sumA = 0,
      sumB = 0;

    for (const oklab of oklabSamples) {
      sumL += oklab.l;
      sumA += oklab.a;
      sumB += oklab.b;
    }

    const avgL = sumL / oklabSamples.length;
    const avgA = sumA / oklabSamples.length;
    const avgB = sumB / oklabSamples.length;

    let variance = 0;
    for (const oklab of oklabSamples) {
      const dl = oklab.l - avgL;
      const da = oklab.a - avgA;
      const db = oklab.b - avgB;
      variance += Math.sqrt(dl * dl + da * da + db * db);
    }
    variance /= oklabSamples.length;

    let optimalCount: number;
    if (variance < 0.1) {
      optimalCount = Math.round(5 + variance * 30);
    } else if (variance < 0.3) {
      optimalCount = Math.round(8 + (variance - 0.1) * 20);
    } else {
      optimalCount = Math.round(12 + Math.min((variance - 0.3) * 10, 3));
    }

    return Math.max(5, Math.min(15, optimalCount));
  }

  private ensureMinimumColors(
    colors: any[],
    pool: any[],
    targetCount: number,
    minColors: number
  ): any[] {
    const needed = Math.min(minColors, targetCount) - colors.length;
    if (needed <= 0) return colors;

    const additional = pool.slice(targetCount, targetCount + needed + 2).filter((candidate) => {
      return !colors.some((existing) => {
        const oklab1 = rgbToOklab(candidate.r, candidate.g, candidate.b);
        const oklab2 = rgbToOklab(existing.r, existing.g, existing.b);
        const dl = oklab1.l - oklab2.l;
        const da = oklab1.a - oklab2.a;
        const db = oklab1.b - oklab2.b;
        return Math.sqrt(dl * dl + da * da * 6 + db * db * 6) < 0.4;
      });
    });

    return [...colors, ...additional.slice(0, needed)];
  }
}
