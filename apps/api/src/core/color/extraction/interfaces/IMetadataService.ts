import type { ExtractedColor, ExtractionMetadata } from '@hue-und-you/types';
import type { SegmentationResult } from './ISegmentationService';

export interface IMetadataService {
  build(
    palette: ExtractedColor[],
    segmentation: SegmentationResult,
    processingStartTime: number
  ): ExtractionMetadata;
}
