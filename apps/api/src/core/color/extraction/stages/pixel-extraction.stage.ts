import sharp from 'sharp';
import { logger } from '../../../../utils';
import { extractPixels, splitPixelsByLuminance } from '../../../segmentation';
import type { PixelData } from '../../../../types/segmentation';
import type { SegmentationResultData } from '../metadata';

export interface PixelExtractionResult {
  fgPixels: PixelData[];
  bgPixels: PixelData[];
  metadata: { width?: number; height?: number };
}

export async function extractPixelsStage(
  imageBuffer: Buffer,
  segmentationResult: SegmentationResultData
): Promise<PixelExtractionResult> {
  logger.info('Pixel extraction stage starting...');

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const { pixels, isForeground } = await extractPixels(
    imageBuffer,
    segmentationResult.foregroundMask
  );
  logger.success(`Sampled ${pixels.length} pixels`);

  let fgPixels = pixels.filter((_, i) => isForeground[i]);
  let bgPixels = pixels.filter((_, i) => !isForeground[i]);

  if (fgPixels.length === 0 || bgPixels.length === 0 || fgPixels.length < pixels.length * 0.05) {
    if (fgPixels.length === 0 || bgPixels.length === 0) {
      logger.warn('Using luminance-based fallback split');
    }
    const split = splitPixelsByLuminance(pixels);
    fgPixels = split.foreground;
    bgPixels = split.background;
  }

  logger.success(
    `Foreground: ${Math.round((fgPixels.length / pixels.length) * 100)}% | Background: ${Math.round((bgPixels.length / pixels.length) * 100)}%`
  );

  return {
    fgPixels,
    bgPixels,
    metadata: { width: metadata.width, height: metadata.height },
  };
}
