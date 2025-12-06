import type { OklabColor } from './color';

export interface SegmentResult {
  label: string;
  mask: string;
  score: number;
}

export interface ForegroundMask {
  mask: Buffer;
  foreground_percentage: number;
}

export interface PixelData {
  r: number;
  g: number;
  b: number;
}

export interface PixelWithWeight extends PixelData {
  weight: number;
}

export interface PixelWithOklab extends PixelData {
  oklab: OklabColor;
}

export interface ExtractedPixels {
  pixels: PixelData[];
  isForeground: boolean[];
}

export type SegmentationMethod = 'mask2former' | 'segformer' | 'fallback-luminance';
export type SegmentationQuality = 'high' | 'medium' | 'low';

export interface SegmentInfo {
  foreground: { pixel_percentage: number };
  background: { pixel_percentage: number };
  categories: string[];
  method?: SegmentationMethod;
  quality?: SegmentationQuality;
}
