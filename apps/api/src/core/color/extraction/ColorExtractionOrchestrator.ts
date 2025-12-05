import type {
  ColorPaletteResult,
  ExtractedColor,
  RGBValues,
  SegmentInfo,
} from '@hue-und-you/types';
import { logger } from '../../../utils';
import { config } from '../../../config';
import type {
  ISegmentationService,
  IPixelExtractionService,
  IClusteringService,
  IColorFormattingService,
  IExportService,
  IMetadataService,
  ExtractionOptions,
  ExtractionHooks,
} from './types';

/**
 * Orchestrates the color extraction pipeline using dependency-injected services.
 * Follows Single Responsibility Principle - only coordinates service calls.
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
    const processingStart = Date.now();
    let partialSent = false;

    logger.info('🎨 Color Extraction Orchestrator: Starting pipeline...');

    // Reset state
    this.colorFormattingService.resetNameTracker();

    // STAGE 1: Segmentation
    logger.info('📐 Stage 1/5: Segmentation');
    const segmentation = await this.segmentationService.segment(imageBuffer);

    // STAGE 2: Pixel Extraction
    logger.info('🎯 Stage 2/5: Pixel Extraction');
    const { fgPixels, bgPixels, metadata } = await this.pixelExtractionService.extract(
      imageBuffer,
      segmentation
    );

    // STAGE 3: Clustering
    logger.info('🔬 Stage 3/5: Clustering');
    const { dominantFgColors, dominantBgColors } = await this.clusteringService.cluster(
      fgPixels,
      bgPixels,
      { numColors: options.numColors }
    );

    // STAGE 4: Color Formatting
    logger.info('🏷️  Stage 4/5: Color Formatting & Naming');
    const palette = await this.formatColors(
      dominantFgColors,
      dominantBgColors,
      options,
      hooks,
      partialSent
    );

    // STAGE 5: Export Generation
    logger.info('📦 Stage 5/5: Export Generation');
    const exports = this.exportService.generate(palette);

    // Build final result
    const segmentInfo = this.buildSegmentInfo(fgPixels.length, bgPixels.length, segmentation);
    const extractionMetadata = this.metadataService.build(palette, segmentation, processingStart);

    logger.success(
      `✨ Pipeline Complete! Extracted ${palette.length} colors in ${Date.now() - processingStart}ms`
    );

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
