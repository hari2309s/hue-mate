import sharp from 'sharp';
import { logger, perfMonitor } from '@hue-und-you/utils';
import { config } from '@hue-und-you/config';
import type {
  ExtractedColor,
  RGBValues,
  ExtractionMetadata,
  PixelData,
  SegmentationResult,
  PixelExtractionResult,
  ClusteringResult,
} from '@hue-und-you/types';
import {
  segmentForegroundBackground,
  segmentSemantic,
  extractPixels,
  extractPixelsMultiScale,
  splitPixelsByLuminance,
} from '@hue-und-you/ml-segmentation';
import {
  applySaturationBias,
  kMeansClusteringOklab,
  deduplicateSimilarColors,
  enforceHueDiversity,
  finalCleanup,
} from '@/clustering';
import { rgbToOklab } from '@/conversion';
import { formatColor, type ColorFormattingOptions } from '@/formatting';
import { generateExports } from '@/export';
import { resetPaletteNameTracker } from '@/naming';

// ============================================================================
// TYPES
// ============================================================================

export type {
  SegmentationResult,
  PixelExtractionResult,
  ClusteringResult,
} from '@hue-und-you/types';
export type { SegmentationMethod, SegmentationQuality } from '@hue-und-you/types';

export interface ExtractionOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

// ============================================================================
// SEGMENTATION SERVICE
// ============================================================================

export class SegmentationService {
  async segment(imageBuffer: Buffer): Promise<SegmentationResult> {
    perfMonitor.start('segmentation-parallel');
    logger.info('🔍 Segmentation service: Starting parallel segmentation...');

    let foregroundMask = null;
    let usedFallback = false;
    let method: SegmentationResult['method'] = 'mask2former';
    let quality: SegmentationResult['quality'] = 'high';
    let confidence = 0.9;
    let categories: string[] = [];

    try {
      const [fgResult, semanticResult] = await Promise.allSettled([
        segmentForegroundBackground(imageBuffer),
        segmentSemantic(imageBuffer),
      ]);

      if (fgResult.status === 'fulfilled') {
        foregroundMask = fgResult.value;

        if (!foregroundMask) {
          logger.warn('Foreground segmentation returned null, flagging as fallback');
          usedFallback = true;
          method = 'fallback-luminance';
          quality = 'medium';
          confidence = 0.5;
        } else {
          const fgPct = foregroundMask.foreground_percentage;

          if (fgPct >= 5 && fgPct <= 70) {
            quality = 'high';
            confidence = 0.9;
          } else if (fgPct >= 1 && fgPct < 5) {
            quality = 'medium';
            confidence = 0.75;
          } else if (fgPct > 70 && fgPct <= 90) {
            quality = 'medium';
            confidence = 0.8;
          } else {
            quality = 'low';
            confidence = 0.6;
          }
        }
      } else {
        logger.error('Foreground segmentation failed', {
          error:
            fgResult.reason instanceof Error ? fgResult.reason.message : String(fgResult.reason),
        });
        usedFallback = true;
        method = 'fallback-luminance';
        quality = 'low';
        confidence = 0.4;
      }

      if (semanticResult.status === 'fulfilled') {
        const segments = semanticResult.value;
        categories = segments.map((s) => s.label).filter(Boolean);
        logger.success(`Retrieved ${categories.length} semantic categories`);
      } else {
        logger.warn('Semantic segmentation failed', {
          error:
            semanticResult.reason instanceof Error
              ? semanticResult.reason.message
              : String(semanticResult.reason),
        });
      }

      perfMonitor.end('segmentation-parallel');
      logger.success(`✓ Parallel segmentation complete: ${method} (${quality} quality)`);

      return {
        foregroundMask,
        method,
        quality,
        usedFallback,
        confidence,
        categories,
      };
    } catch (error) {
      perfMonitor.end('segmentation-parallel');
      logger.error('Unexpected segmentation error', { error });

      return {
        foregroundMask: null,
        method: 'fallback-luminance',
        quality: 'low',
        usedFallback: true,
        confidence: 0.3,
        categories: [],
      };
    }
  }
}

// ============================================================================
// PIXEL EXTRACTION SERVICE
// ============================================================================

export class PixelExtractionService {
  async extract(
    imageBuffer: Buffer,
    segmentation: SegmentationResult
  ): Promise<PixelExtractionResult> {
    perfMonitor.start('pixel-extraction');
    logger.info('🎯 Pixel extraction service: Starting...');

    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      const totalPixels = (metadata.width || 0) * (metadata.height || 0);

      const useMultiScale =
        Boolean(config.performance?.enableMultiScale) !== false &&
        totalPixels > (config.performance?.multiScaleThreshold || 10000000);

      let pixels, isForeground;

      if (useMultiScale) {
        logger.info('Using multi-scale extraction for large image');
        perfMonitor.start('pixel-extraction.multi-scale');
        ({ pixels, isForeground } = await extractPixelsMultiScale(
          imageBuffer,
          segmentation.foregroundMask
        ));
        perfMonitor.end('pixel-extraction.multi-scale');
      } else {
        perfMonitor.start('pixel-extraction.single-scale');
        ({ pixels, isForeground } = await extractPixels(imageBuffer, segmentation.foregroundMask));
        perfMonitor.end('pixel-extraction.single-scale');
      }

      logger.success(`Sampled ${pixels.length} pixels`);

      let fgPixels = pixels.filter((_, i) => isForeground[i]);
      let bgPixels = pixels.filter((_, i) => !isForeground[i]);

      if (
        fgPixels.length === 0 ||
        bgPixels.length === 0 ||
        fgPixels.length < pixels.length * 0.05
      ) {
        logger.warn('Using luminance-based fallback split');
        perfMonitor.start('pixel-extraction.fallback');
        const split = splitPixelsByLuminance(pixels);
        fgPixels = split.foreground;
        bgPixels = split.background;
        perfMonitor.end('pixel-extraction.fallback');
      }

      logger.success(
        `✓ Extraction complete: ${Math.round((fgPixels.length / pixels.length) * 100)}% FG | ${Math.round((bgPixels.length / pixels.length) * 100)}% BG`
      );

      return {
        fgPixels,
        bgPixels,
        metadata: { width: metadata.width, height: metadata.height },
      };
    } finally {
      perfMonitor.end('pixel-extraction');
    }
  }
}

// ============================================================================
// CLUSTERING SERVICE
// ============================================================================

export class ClusteringService {
  async cluster(
    fgPixels: PixelData[],
    bgPixels: PixelData[],
    options?: { numColors?: number }
  ): Promise<ClusteringResult> {
    perfMonitor.start('clustering');
    logger.info('🔬 Clustering service: Starting...');

    try {
      const optimalCount = this.determineOptimalColorCount(fgPixels, bgPixels, options?.numColors);

      const fgRatio = fgPixels.length / (fgPixels.length + bgPixels.length);
      const fgColorCount = Math.max(2, Math.round(optimalCount * Math.max(0.3, fgRatio)));
      const bgColorCount = Math.max(2, optimalCount - fgColorCount);

      logger.info(`Distributing colors: ${fgColorCount} FG + ${bgColorCount} BG`);

      perfMonitor.start('clustering.saturation-bias');
      const biasedFgPixels = applySaturationBias(fgPixels);
      const biasedBgPixels = applySaturationBias(bgPixels);
      perfMonitor.end('clustering.saturation-bias');

      perfMonitor.start('clustering.kmeans');
      const rawFgColors =
        biasedFgPixels.length > 0 ? kMeansClusteringOklab(biasedFgPixels, fgColorCount * 4) : [];
      const rawBgColors =
        biasedBgPixels.length > 0 ? kMeansClusteringOklab(biasedBgPixels, bgColorCount * 4) : [];
      perfMonitor.end('clustering.kmeans');

      perfMonitor.start('clustering.deduplication');
      const dedupedFg = deduplicateSimilarColors(rawFgColors, 0.35);
      const dedupedBg = deduplicateSimilarColors(rawBgColors, 0.35);
      perfMonitor.end('clustering.deduplication');

      perfMonitor.start('clustering.diversity');
      const diverseFg = enforceHueDiversity(dedupedFg, 35);
      const diverseBg = enforceHueDiversity(dedupedBg, 35);
      perfMonitor.end('clustering.diversity');

      const slicedFg = diverseFg.slice(0, fgColorCount);
      const slicedBg = diverseBg.slice(0, bgColorCount);

      perfMonitor.start('clustering.final-cleanup');
      let dominantFgColors = finalCleanup(slicedFg);
      let dominantBgColors = finalCleanup(slicedBg);
      perfMonitor.end('clustering.final-cleanup');

      dominantFgColors = this.ensureMinimumColors(dominantFgColors, diverseFg, fgColorCount, 2);
      dominantBgColors = this.ensureMinimumColors(dominantBgColors, diverseBg, bgColorCount, 2);

      logger.success(
        `✓ Clustering complete: ${dominantFgColors.length} FG + ${dominantBgColors.length} BG`
      );

      return { dominantFgColors, dominantBgColors };
    } finally {
      perfMonitor.end('clustering');
    }
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

// ============================================================================
// COLOR FORMATTING SERVICE
// ============================================================================

export class ColorFormattingService {
  async format(
    rgb: RGBValues,
    weight: number,
    segment: 'foreground' | 'background',
    index: number,
    options?: ColorFormattingOptions
  ): Promise<ExtractedColor> {
    return formatColor(rgb, weight, segment, index, options);
  }

  resetNameTracker(): void {
    resetPaletteNameTracker();
  }
}

// ============================================================================
// EXPORT SERVICE
// ============================================================================

export class ExportService {
  generate(palette: ExtractedColor[]) {
    return generateExports(palette);
  }
}

// ============================================================================
// METADATA SERVICE
// ============================================================================

export class MetadataService {
  build(
    palette: ExtractedColor[],
    segmentation: SegmentationResult,
    processingStartTime: number
  ): ExtractionMetadata {
    return buildExtractionMetadata(palette, segmentation, processingStartTime);
  }
}

// ============================================================================
// METADATA BUILDER
// ============================================================================

function computeColorDiversity(colors: ExtractedColor[]): number {
  if (colors.length === 0) return 0;
  const weights = colors.map((c) => Math.max(c.source.pixel_coverage, 0));
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const entropy = weights.reduce((sum, weight) => {
    const p = weight / total;
    return p > 0 ? sum - p * Math.log(p) : sum;
  }, 0);
  const normalized = colors.length > 1 ? entropy / Math.log(colors.length) : 0;
  return Number(Math.max(0, Math.min(1, normalized)).toFixed(2));
}

function computeColorSeparation(colors: ExtractedColor[]): number {
  if (colors.length < 2) return 1.0;

  let totalDistance = 0;
  let count = 0;

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const c1 = colors[i].formats.oklch.values;
      const c2 = colors[j].formats.oklch.values;

      const dl = (c1.l - c2.l) * 100;
      const dc = (c1.c - c2.c) * 250;

      let dh = Math.abs(c1.h - c2.h);
      if (dh > 180) dh = 360 - dh;
      dh = dh * 1.5;

      const distance = Math.sqrt(dl * dl + dc * dc + dh * dh);

      totalDistance += distance;
      count++;
    }
  }

  const avgDistance = totalDistance / count;
  const normalized = Math.max(0, Math.min(1, (avgDistance - 40) / 60));
  return Math.round(normalized * 100) / 100;
}

function resolveDominantTemperature(colors: ExtractedColor[]): 'warm' | 'cool' | 'neutral' {
  const tally = colors.reduce(
    (acc, color) => {
      acc[color.metadata.temperature] += 1;
      return acc;
    },
    { warm: 0, cool: 0, neutral: 0 }
  );
  return (
    (Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] as 'warm' | 'cool' | 'neutral') ??
    'neutral'
  );
}

function buildSuggestedUsage(
  dominantTemperature: 'warm' | 'cool' | 'neutral',
  colorDiversity: number,
  averageSaturation: number
): string {
  if (averageSaturation >= 65) {
    return 'Vibrant palette for energetic, expressive designs';
  }
  if (dominantTemperature === 'cool') {
    return colorDiversity >= 0.7
      ? 'Professional, calming palette with rich accents'
      : 'Minimal, cool-toned palette';
  }
  if (dominantTemperature === 'warm') {
    return 'Inviting palette ideal for lifestyle or hospitality brands';
  }
  return colorDiversity >= 0.7
    ? 'Versatile palette for modern interfaces'
    : 'Balanced palette for everyday use';
}

export function buildExtractionMetadata(
  palette: ExtractedColor[],
  segmentationResult: SegmentationResult,
  processingStartTime: number
): ExtractionMetadata {
  const colorDiversity = computeColorDiversity(palette);
  const colorSeparation = computeColorSeparation(palette);
  const averageSaturation =
    palette.reduce((sum, color) => sum + color.formats.hsl.values.s, 0) /
    Math.max(palette.length, 1);
  const dominantTemperature = resolveDominantTemperature(palette);

  const uniqueNames = new Set(palette.map((c) => c.name));
  const namingQuality = uniqueNames.size / palette.length;

  return {
    processingTimeMs: Date.now() - processingStartTime,
    colorCount: palette.length,
    algorithm: 'weighted-kmeans',
    colorDiversity,
    averageSaturation: Math.round(averageSaturation),
    dominantTemperature,
    suggestedUsage: buildSuggestedUsage(dominantTemperature, colorDiversity, averageSaturation),
    segmentationQuality: {
      method: segmentationResult.method,
      confidence:
        segmentationResult.quality === 'high'
          ? 'high'
          : segmentationResult.quality === 'medium'
            ? 'medium'
            : 'low',
      foregroundDetected: !!segmentationResult.foregroundMask && !segmentationResult.usedFallback,
      usedFallback: segmentationResult.usedFallback,
    },
    extractionConfidence: {
      overall:
        Math.round(((segmentationResult.confidence + colorSeparation + namingQuality) / 3) * 100) /
        100,
      colorSeparation: Math.round(colorSeparation * 100) / 100,
      namingQuality: Math.round(namingQuality * 100) / 100,
    },
  };
}
