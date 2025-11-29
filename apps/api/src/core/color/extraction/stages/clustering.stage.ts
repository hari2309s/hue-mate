import { logger } from '../../../../utils';
import {
  applySaturationBias,
  kMeansClusteringOklab,
  deduplicateSimilarColors,
  enforceHueDiversity,
  finalCleanup,
} from '../../../color/clustering';
import { rgbToOklab } from '../../../color/conversion';
import type { PixelData, PixelWithWeight } from '../../../../types/segmentation';

export interface ClusteringResult {
  dominantFgColors: PixelWithWeight[];
  dominantBgColors: PixelWithWeight[];
}

/**
 * Determines optimal number of colors to extract based on image characteristics
 */
function determineOptimalColorCount(
  fgPixels: PixelData[],
  bgPixels: PixelData[],
  requestedCount?: number
): number {
  const totalPixels = fgPixels.length + bgPixels.length;

  if (requestedCount) {
    return requestedCount;
  }

  // Adaptive color count based on pixel diversity
  // Sample pixels to estimate color diversity
  const sampleSize = Math.min(500, totalPixels);
  const step = Math.floor(totalPixels / sampleSize);
  const samples: PixelData[] = [];

  for (let i = 0; i < fgPixels.length; i += step) {
    samples.push(fgPixels[i]);
  }
  for (let i = 0; i < bgPixels.length; i += step) {
    samples.push(bgPixels[i]);
  }

  // Calculate color variance in OKLab space
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

  // Map variance to color count
  // Low variance (0-0.1): 5-8 colors (monochromatic/limited palette)
  // Medium variance (0.1-0.3): 8-12 colors (typical photos)
  // High variance (0.3+): 12-15 colors (vibrant/diverse images)

  let optimalCount: number;
  if (variance < 0.1) {
    optimalCount = Math.round(5 + variance * 30); // 5-8 colors
  } else if (variance < 0.3) {
    optimalCount = Math.round(8 + (variance - 0.1) * 20); // 8-12 colors
  } else {
    optimalCount = Math.round(12 + Math.min((variance - 0.3) * 10, 3)); // 12-15 colors
  }

  logger.info(`Determined optimal color count: ${optimalCount} (variance: ${variance.toFixed(3)})`);

  return Math.max(5, Math.min(15, optimalCount));
}

export async function performClustering(
  fgPixels: PixelData[],
  bgPixels: PixelData[],
  requestedColorCount?: number
): Promise<ClusteringResult> {
  logger.info('Clustering stage starting (deterministic mode)...');

  // Determine optimal color count
  const optimalCount = determineOptimalColorCount(fgPixels, bgPixels, requestedColorCount);
  logger.info(
    `Target color count: ${optimalCount}${requestedColorCount ? ' (user-requested)' : ' (auto-detected)'}`
  );

  const fgRatio = fgPixels.length / (fgPixels.length + bgPixels.length);
  const fgColorCount = Math.max(2, Math.round(optimalCount * Math.max(0.3, fgRatio)));
  const bgColorCount = Math.max(2, optimalCount - fgColorCount);

  logger.info(`Distributing colors: ${fgColorCount} foreground + ${bgColorCount} background`);

  // Apply saturation bias (deterministic - no randomness)
  const biasedFgPixels = applySaturationBias(fgPixels);
  const biasedBgPixels = applySaturationBias(bgPixels);

  // K-means clustering with larger initial pool for better quality
  const rawFgColors =
    biasedFgPixels.length > 0 ? kMeansClusteringOklab(biasedFgPixels, fgColorCount * 4) : [];
  const rawBgColors =
    biasedBgPixels.length > 0 ? kMeansClusteringOklab(biasedBgPixels, bgColorCount * 4) : [];

  logger.info(`Generated ${rawFgColors.length} FG + ${rawBgColors.length} BG candidates`);

  // Deduplication (deterministic - no random selection)
  const dedupedFg = deduplicateSimilarColors(rawFgColors, 0.35);
  const dedupedBg = deduplicateSimilarColors(rawBgColors, 0.35);

  logger.info(`After deduplication: ${dedupedFg.length} FG + ${dedupedBg.length} BG`);

  // Hue diversity enforcement (deterministic - based on color values)
  const diverseFg = enforceHueDiversity(dedupedFg, 35);
  const diverseBg = enforceHueDiversity(dedupedBg, 35);

  logger.info(`After hue diversity: ${diverseFg.length} FG + ${diverseBg.length} BG`);

  // Slice to target count
  const slicedFg = diverseFg.slice(0, fgColorCount);
  const slicedBg = diverseBg.slice(0, bgColorCount);

  // Final cleanup (deterministic merge)
  const dominantFgColors = finalCleanup(slicedFg);
  const dominantBgColors = finalCleanup(slicedBg);

  logger.success(
    `Final palette: ${dominantFgColors.length} FG + ${dominantBgColors.length} BG colors`
  );

  // Add back colors if needed (deterministically from pool)
  const minFgColors = Math.min(2, fgColorCount);
  if (dominantFgColors.length < minFgColors) {
    logger.info('Adding FG colors from pool (deterministic)');
    const needed = minFgColors - dominantFgColors.length;
    const additional = diverseFg
      .slice(fgColorCount, fgColorCount + needed + 2)
      .filter((candidate) => {
        return !dominantFgColors.some((existing) => {
          const oklab1 = rgbToOklab(candidate.r, candidate.g, candidate.b);
          const oklab2 = rgbToOklab(existing.r, existing.g, existing.b);
          const dl = oklab1.l - oklab2.l;
          const da = oklab1.a - oklab2.a;
          const db = oklab1.b - oklab2.b;
          return Math.sqrt(dl * dl + da * da * 6 + db * db * 6) < 0.4;
        });
      });
    dominantFgColors.push(...additional.slice(0, needed));
  }

  const minBgColors = Math.min(2, bgColorCount);
  if (dominantBgColors.length < minBgColors) {
    logger.info('Adding BG colors from pool (deterministic)');
    const needed = minBgColors - dominantBgColors.length;
    const additional = diverseBg
      .slice(bgColorCount, bgColorCount + needed + 2)
      .filter((candidate) => {
        return !dominantBgColors.some((existing) => {
          const oklab1 = rgbToOklab(candidate.r, candidate.g, candidate.b);
          const oklab2 = rgbToOklab(existing.r, existing.g, existing.b);
          const dl = oklab1.l - oklab2.l;
          const da = oklab1.a - oklab2.a;
          const db = oklab1.b - oklab2.b;
          return Math.sqrt(dl * dl + da * da * 6 + db * db * 6) < 0.4;
        });
      });
    dominantBgColors.push(...additional.slice(0, needed));
  }

  logger.success(
    `Final deterministic palette: ${dominantFgColors.length} FG + ${dominantBgColors.length} BG (total: ${dominantFgColors.length + dominantBgColors.length})`
  );

  return { dominantFgColors, dominantBgColors };
}
