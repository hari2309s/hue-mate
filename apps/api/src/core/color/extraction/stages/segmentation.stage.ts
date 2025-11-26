import { ForegroundMask } from '../../../../types/segmentation';
import { logger } from '../../../../utils';
import { segmentForegroundBackground, segmentSemantic } from '../../../segmentation';
import type { SegmentationResultData } from '../metadata';

export async function performSegmentation(imageBuffer: Buffer): Promise<SegmentationResultData> {
  logger.info('Segmentation stage starting...');

  let foregroundMask: ForegroundMask | null = null;
  let usedFallback = false;
  let method: 'mask2former' | 'fallback-luminance' = 'mask2former';
  let quality: 'high' | 'medium' | 'low' = 'high';
  let confidence = 0.9;

  try {
    foregroundMask = await segmentForegroundBackground(imageBuffer);

    if (!foregroundMask) {
      logger.warn('Segmentation returned null, using fallback');
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
        logger.info('Small foreground detected - may be architectural detail');
      } else if (fgPct > 70 && fgPct <= 90) {
        quality = 'medium';
        confidence = 0.8;
      } else {
        quality = 'low';
        confidence = 0.6;
        logger.warn('Unusual foreground percentage, segmentation may be unreliable');
      }
    }
  } catch (error) {
    logger.error(`Segmentation failed: ${error}`);
    usedFallback = true;
    method = 'fallback-luminance';
    quality = 'low';
    confidence = 0.4;
  }

  // Semantic segmentation
  let segments: any[] = [];
  try {
    segments = await segmentSemantic(imageBuffer);
  } catch (error) {
    logger.error(`Semantic segmentation failed: ${error}`);
  }

  const categories = segments.map((s) => s.label).filter(Boolean);
  if (categories.length > 0) {
    logger.success(`Identified ${categories.length} semantic regions: ${categories.join(', ')}`);
  }

  return {
    foregroundMask,
    method,
    quality,
    usedFallback,
    confidence,
    categories,
  };
}
