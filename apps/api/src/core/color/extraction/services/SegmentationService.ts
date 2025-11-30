import { logger } from '../../../../utils';
import { segmentForegroundBackground, segmentSemantic } from '../../../segmentation';
import type {
  ISegmentationService,
  SegmentationResult,
  SegmentationMethod,
  SegmentationQuality,
} from '../interfaces';

export class SegmentationService implements ISegmentationService {
  async segment(imageBuffer: Buffer): Promise<SegmentationResult> {
    logger.info('🔍 Segmentation service: Starting...');

    let foregroundMask = null;
    let usedFallback = false;
    let method: SegmentationMethod = 'mask2former';
    let quality: SegmentationQuality = 'high';
    let confidence = 0.9;

    try {
      foregroundMask = await segmentForegroundBackground(imageBuffer);

      if (!foregroundMask) {
        logger.warn('Segmentation returned null, flagging as fallback');
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
    } catch (error) {
      logger.error('Segmentation failed', { error });
      usedFallback = true;
      method = 'fallback-luminance';
      quality = 'low';
      confidence = 0.4;
    }

    // Semantic segmentation for categories
    let categories: string[] = [];
    try {
      const segments = await segmentSemantic(imageBuffer);
      categories = segments.map((s) => s.label).filter(Boolean);
    } catch (error) {
      logger.error('Semantic segmentation failed', { error });
    }

    logger.success(`✓ Segmentation complete: ${method} (${quality} quality)`);

    return {
      foregroundMask,
      method,
      quality,
      usedFallback,
      confidence,
      categories,
    };
  }
}
