import { logger, perfMonitor } from '@hue-und-you/utils';
import { segmentForegroundBackground, segmentSemantic } from '@hue-und-you/ml-segmentation';
import type {
  ISegmentationService,
  SegmentationResult,
  SegmentationMethod,
  SegmentationQuality,
} from '@/core/color/extraction/types';

export class SegmentationService implements ISegmentationService {
  async segment(imageBuffer: Buffer): Promise<SegmentationResult> {
    perfMonitor.start('segmentation-parallel');
    logger.info('🔍 Segmentation service: Starting parallel segmentation...');

    let foregroundMask = null;
    let usedFallback = false;
    let method: SegmentationMethod = 'mask2former';
    let quality: SegmentationQuality = 'high';
    let confidence = 0.9;
    let categories: string[] = [];

    try {
      // Run both segmentation operations in parallel
      const [fgResult, semanticResult] = await Promise.allSettled([
        segmentForegroundBackground(imageBuffer),
        segmentSemantic(imageBuffer),
      ]);

      // Process foreground/background result
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

      // Process semantic segmentation result
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

      // Return fallback configuration
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
