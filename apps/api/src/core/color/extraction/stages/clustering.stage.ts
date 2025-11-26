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

export async function performClustering(
  fgPixels: PixelData[],
  bgPixels: PixelData[],
  numColors: number
): Promise<ClusteringResult> {
  logger.info('Clustering stage starting...');

  const fgRatio = fgPixels.length / (fgPixels.length + bgPixels.length);
  const fgColorCount = Math.max(1, Math.round(numColors * fgRatio));
  const bgColorCount = Math.max(1, numColors - fgColorCount);

  const biasedFgPixels = applySaturationBias(fgPixels);
  const biasedBgPixels = applySaturationBias(bgPixels);

  const rawFgColors =
    biasedFgPixels.length > 0 ? kMeansClusteringOklab(biasedFgPixels, fgColorCount * 4) : [];
  const rawBgColors =
    biasedBgPixels.length > 0 ? kMeansClusteringOklab(biasedBgPixels, bgColorCount * 4) : [];

  logger.info(`Generated ${rawFgColors.length} FG + ${rawBgColors.length} BG candidates`);

  const dedupedFg = deduplicateSimilarColors(rawFgColors, 0.35);
  const dedupedBg = deduplicateSimilarColors(rawBgColors, 0.35);

  logger.info(`After initial dedup: ${dedupedFg.length} FG + ${dedupedBg.length} BG`);

  const diverseFg = enforceHueDiversity(dedupedFg, 35);
  const diverseBg = enforceHueDiversity(dedupedBg, 35);

  logger.info(`After hue diversity: ${diverseFg.length} FG + ${diverseBg.length} BG`);

  const slicedFg = diverseFg.slice(0, fgColorCount);
  const slicedBg = diverseBg.slice(0, bgColorCount);

  const dominantFgColors = finalCleanup(slicedFg);
  const dominantBgColors = finalCleanup(slicedBg);

  logger.success(
    `After final cleanup: ${dominantFgColors.length} FG + ${dominantBgColors.length} BG colors`
  );

  // Add back if we lost too many
  if (dominantFgColors.length < Math.min(2, fgColorCount)) {
    logger.info('Insufficient FG colors after cleanup, adding from pool');
    const needed = Math.min(2, fgColorCount) - dominantFgColors.length;
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

  if (dominantBgColors.length < Math.min(3, bgColorCount)) {
    logger.info('Insufficient BG colors after cleanup, adding from pool');
    const needed = Math.min(3, bgColorCount) - dominantBgColors.length;
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
    `Final palette: ${dominantFgColors.length} FG + ${dominantBgColors.length} BG colors`
  );

  return { dominantFgColors, dominantBgColors };
}
