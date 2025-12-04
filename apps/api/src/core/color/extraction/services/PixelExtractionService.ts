import sharp from 'sharp';
import { logger } from '../../../../utils';
import { extractPixels, splitPixelsByLuminance } from '../../../segmentation';
import type { IPixelExtractionService, PixelExtractionResult } from '../types';
import type { SegmentationResult } from '../types';

export class PixelExtractionService implements IPixelExtractionService {
  async extract(
    imageBuffer: Buffer,
    segmentation: SegmentationResult
  ): Promise<PixelExtractionResult> {
    logger.info('🎯 Pixel extraction service: Starting...');

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const { pixels, isForeground } = await extractPixels(imageBuffer, segmentation.foregroundMask);
    logger.success(`Sampled ${pixels.length} pixels`);

    let fgPixels = pixels.filter((_, i) => isForeground[i]);
    let bgPixels = pixels.filter((_, i) => !isForeground[i]);

    // Fallback to luminance split if needed
    if (fgPixels.length === 0 || bgPixels.length === 0 || fgPixels.length < pixels.length * 0.05) {
      logger.warn('Using luminance-based fallback split');
      const split = splitPixelsByLuminance(pixels);
      fgPixels = split.foreground;
      bgPixels = split.background;
    }

    logger.success(
      `✓ Extraction complete: ${Math.round((fgPixels.length / pixels.length) * 100)}% FG | ${Math.round((bgPixels.length / pixels.length) * 100)}% BG`
    );

    return {
      fgPixels,
      bgPixels,
      metadata: { width: metadata.width, height: metadata.height },
    };
  }
}
