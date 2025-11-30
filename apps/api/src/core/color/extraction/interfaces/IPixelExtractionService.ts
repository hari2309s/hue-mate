import type { PixelData } from '../../../../types/segmentation';
import type { SegmentationResult } from './ISegmentationService';

export interface PixelExtractionResult {
  fgPixels: PixelData[];
  bgPixels: PixelData[];
  metadata: {
    width?: number;
    height?: number;
  };
}

export interface IPixelExtractionService {
  extract(imageBuffer: Buffer, segmentation: SegmentationResult): Promise<PixelExtractionResult>;
}
