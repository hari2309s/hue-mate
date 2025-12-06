import sharp from 'sharp';
import { logger, perfMonitor } from '@/utils';
import { config } from '@/config';
import {
  extractPixels,
  extractPixelsMultiScale,
  splitPixelsByLuminance,
} from '@/core/segmentation';
import type { IPixelExtractionService, PixelExtractionResult } from '@/core/color/extraction/types';
import type { SegmentationResult } from '@/core/color/extraction/types';

export class PixelExtractionService implements IPixelExtractionService {
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

      // Use multi-scale for very large images if enabled
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

      // Fallback to luminance split if needed
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
