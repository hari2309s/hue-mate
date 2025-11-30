import { buildExtractionMetadata } from '../metadata';
import type { IMetadataService } from '../interfaces';
import type { ExtractedColor, ExtractionMetadata } from '@hue-und-you/types';
import type { SegmentationResult } from '../interfaces';

export class MetadataService implements IMetadataService {
  build(
    palette: ExtractedColor[],
    segmentation: SegmentationResult,
    processingStartTime: number
  ): ExtractionMetadata {
    return buildExtractionMetadata(
      palette,
      {
        foregroundMask: segmentation.foregroundMask,
        method: segmentation.method,
        quality: segmentation.quality,
        usedFallback: segmentation.usedFallback,
        confidence: segmentation.confidence,
        categories: segmentation.categories,
      },
      processingStartTime
    );
  }
}
