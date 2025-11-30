import type { ForegroundMask } from '../../../../types/segmentation';

export type SegmentationMethod = 'mask2former' | 'segformer' | 'fallback-luminance';
export type SegmentationQuality = 'high' | 'medium' | 'low';

export interface SegmentationResult {
  foregroundMask: ForegroundMask | null;
  method: SegmentationMethod;
  quality: SegmentationQuality;
  usedFallback: boolean;
  confidence: number;
  categories: string[];
}

export interface ISegmentationService {
  segment(imageBuffer: Buffer): Promise<SegmentationResult>;
}
