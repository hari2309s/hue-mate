import type { OklabColor } from './color';

/**
 * Segmentation result from ML models
 */
export interface SegmentResult {
  label: string;
  mask: string;
  score: number;
}

/**
 * Foreground mask with percentage
 */
export interface ForegroundMask {
  mask: Buffer;
  foreground_percentage: number;
}

/**
 * Basic pixel data (RGB values)
 */
export interface PixelData {
  r: number;
  g: number;
  b: number;
}

/**
 * Pixel with weight for clustering
 */
export interface PixelWithWeight extends PixelData {
  weight: number;
}

/**
 * Pixel with OKLab color space conversion
 */
export interface PixelWithOklab extends PixelData {
  oklab: OklabColor;
}

/**
 * Extracted pixels with foreground/background classification
 */
export interface ExtractedPixels {
  pixels: PixelData[];
  isForeground: boolean[];
}

/**
 * Segmentation method types
 */
export type SegmentationMethod = 'mask2former' | 'segformer' | 'fallback-luminance';

/**
 * Segmentation quality levels
 */
export type SegmentationQuality = 'high' | 'medium' | 'low';

/**
 * Segment information in extraction result
 */
export interface SegmentInfo {
  foreground: { pixel_percentage: number };
  background: { pixel_percentage: number };
  categories: string[];
  method?: SegmentationMethod;
  quality?: SegmentationQuality;
}

/**
 * Complete segmentation result from service
 */
export interface SegmentationResult {
  foregroundMask: ForegroundMask | null;
  method: SegmentationMethod;
  quality: SegmentationQuality;
  usedFallback: boolean;
  confidence: number;
  categories: string[];
}

/**
 * Pixel extraction result from service
 */
export interface PixelExtractionResult {
  fgPixels: PixelData[];
  bgPixels: PixelData[];
  metadata: {
    width?: number;
    height?: number;
  };
}

/**
 * Clustering result from service
 */
export interface ClusteringResult {
  dominantFgColors: Array<PixelData & { weight: number }>;
  dominantBgColors: Array<PixelData & { weight: number }>;
}
