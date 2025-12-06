import type {
  ColorPaletteResult,
  ExtractedColor,
  RGBValues,
  SegmentInfo,
} from '@hue-und-you/types';
import { logger, perfMonitor } from '@/utils';
import { config } from '@/config';
import { clearConversionCaches, getConversionCacheStats } from '@/core/color/conversion';
import type {
  ISegmentationService,
  IPixelExtractionService,
  IClusteringService,
  IColorFormattingService,
  IExportService,
  IMetadataService,
  ExtractionOptions,
  ExtractionHooks,
} from '@/core/color/extraction/types';

/**
 * Orchestrates the color extraction pipeline using dependency-injected services.
 * Now with performance monitoring and cache management.
 */
export class ColorExtractionOrchestrator {
  constructor(
    private segmentationService: ISegmentationService,
    private pixelExtractionService: IPixelExtractionService,
    private clusteringService: IClusteringService,
    private colorFormattingService: IColorFormattingService,
    private exportService: IExportService,
    private metadataService: IMetadataService
  ) {}

  async extract(
    imageBuffer: Buffer,
    filename: string,
    options: ExtractionOptions = {},
    hooks: ExtractionHooks = {}
  ): Promise<ColorPaletteResult> {
    perfMonitor.start('full-pipeline');
    const processingStart = Date.now();
    let partialSent = false;

    logger.info('🎨 Color Extraction Orchestrator: Starting pipeline...');

    try {
      // Clear conversion caches to start fresh
      if (Boolean(config.performance?.enableConversionCache) !== false) {
        clearConversionCaches();
      }

      // Reset state
      this.colorFormattingService.resetNameTracker();

      // STAGE 1: Segmentation
      perfMonitor.start('stage-1-segmentation');
      logger.info('📐 Stage 1/5: Segmentation');
      const segmentation = await this.segmentationService.segment(imageBuffer);
      perfMonitor.end('stage-1-segmentation');

      // STAGE 2: Pixel Extraction
      perfMonitor.start('stage-2-pixel-extraction');
      logger.info('🎯 Stage 2/5: Pixel Extraction');
      const { fgPixels, bgPixels, metadata } = await this.pixelExtractionService.extract(
        imageBuffer,
        segmentation
      );
      perfMonitor.end('stage-2-pixel-extraction');

      // STAGE 3: Clustering
      perfMonitor.start('stage-3-clustering');
      logger.info('🔬 Stage 3/5: Clustering');
      const { dominantFgColors, dominantBgColors } = await this.clusteringService.cluster(
        fgPixels,
        bgPixels,
        { numColors: options.numColors }
      );
      perfMonitor.end('stage-3-clustering');

      // STAGE 4: Color Formatting
      perfMonitor.start('stage-4-formatting');
      logger.info('🏷️  Stage 4/5: Color Formatting & Naming');
      const palette = await this.formatColors(
        dominantFgColors,
        dominantBgColors,
        options,
        hooks,
        partialSent
      );
      perfMonitor.end('stage-4-formatting');

      // STAGE 5: Export Generation
      perfMonitor.start('stage-5-export');
      logger.info('📦 Stage 5/5: Export Generation');
      const exports = this.exportService.generate(palette);
      perfMonitor.end('stage-5-export');

      // Build final result
      const segmentInfo = this.buildSegmentInfo(fgPixels.length, bgPixels.length, segmentation);
      const extractionMetadata = this.metadataService.build(palette, segmentation, processingStart);

      const totalTime = Date.now() - processingStart;

      logger.success(`✨ Pipeline Complete! Extracted ${palette.length} colors in ${totalTime}ms`);

      // Log cache statistics if enabled
      if (Boolean(config.performance?.enableConversionCache) !== false) {
        const cacheStats = getConversionCacheStats();
        logger.info('Cache statistics', {
          oklabSize: cacheStats.oklab.size,
          hslSize: cacheStats.hsl.size,
          oklchSize: cacheStats.oklch.size,
        });
      }

      // Print performance summary in development
      if (config.app.isDevelopment || process.env.LOG_PERFORMANCE === 'true') {
        perfMonitor.printSummary();
      }

      return {
        id: `palette_${Date.now()}`,
        source_image: {
          filename,
          dimensions: {
            width: metadata.width || 0,
            height: metadata.height || 0,
          },
          processed_at: new Date().toISOString(),
        },
        segments: segmentInfo,
        palette,
        exports,
        metadata: extractionMetadata,
      };
    } finally {
      perfMonitor.end('full-pipeline');

      // Reset monitor for next extraction
      if (!config.app.isDevelopment && process.env.LOG_PERFORMANCE !== 'true') {
        perfMonitor.reset();
      }
    }
  }

  private async formatColors(
    fgColors: any[],
    bgColors: any[],
    options: ExtractionOptions,
    hooks: ExtractionHooks,
    partialSent: boolean
  ): Promise<ExtractedColor[]> {
    const palette: ExtractedColor[] = [];
    let colorIndex = 1;

    const combined = [
      ...fgColors.map((c) => ({ ...c, segment: 'foreground' as const })),
      ...bgColors.map((c) => ({ ...c, segment: 'background' as const })),
    ].sort((a, b) => b.weight - a.weight);

    for (const colorData of combined) {
      const rgb: RGBValues = { r: colorData.r, g: colorData.g, b: colorData.b };

      const color = await this.colorFormattingService.format(
        rgb,
        colorData.weight,
        colorData.segment,
        colorIndex++,
        { generateHarmonies: options.generateHarmonies }
      );

      palette.push(color);

      // Send partial results
      if (!partialSent && palette.length >= config.app.partialColorCount) {
        hooks.onPartial?.(palette.slice(0, config.app.partialColorCount));
        partialSent = true;
      }
    }

    // Ensure at least one partial was sent
    if (!partialSent && palette.length > 0) {
      hooks.onPartial?.(palette.slice(0, Math.min(config.app.partialColorCount, palette.length)));
    }

    return palette;
  }

  private buildSegmentInfo(
    fgPixelCount: number,
    bgPixelCount: number,
    segmentation: any
  ): SegmentInfo {
    const totalPixels = fgPixelCount + bgPixelCount;
    const fgRatio = fgPixelCount / totalPixels;

    return {
      foreground: {
        pixel_percentage: segmentation.foregroundMask
          ? Math.round(segmentation.foregroundMask.foreground_percentage * 10) / 10
          : Math.round(fgRatio * 1000) / 10,
      },
      background: {
        pixel_percentage: segmentation.foregroundMask
          ? Math.round((100 - segmentation.foregroundMask.foreground_percentage) * 10) / 10
          : Math.round((1 - fgRatio) * 1000) / 10,
      },
      categories: segmentation.categories,
      method: segmentation.method,
      quality: segmentation.quality,
    };
  }
}
