import { buildExtractionMetadata } from '../metadata';
import type { IMetadataService, SegmentationResult } from '../types';
import type { ExtractedColor, ExtractionMetadata } from '@hue-und-you/types';

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
