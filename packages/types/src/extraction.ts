import type { ExtractedColor } from './color';
import type {
  SegmentInfo,
  SegmentationMethod,
  SegmentationQuality,
  ForegroundMask,
  PixelData,
} from './segmentation';

export interface ExtractionMetadata {
  processingTimeMs: number;
  colorCount: number;
  algorithm: 'kmeans++' | 'weighted-kmeans';
  colorDiversity: number;
  averageSaturation: number;
  dominantTemperature: 'warm' | 'cool' | 'neutral';
  suggestedUsage: string;
  segmentationQuality: {
    method: SegmentationMethod;
    confidence: 'high' | 'medium' | 'low';
    foregroundDetected: boolean;
    usedFallback: boolean;
  };
  extractionConfidence: {
    overall: number;
    colorSeparation: number;
    namingQuality: number;
  };
}

export interface ExportFormats {
  css_variables: string;
  tailwind_config: object;
  figma_tokens: object;
  swift?: string;
  kotlin?: string;
  scss_variables: string;
}

export interface ColorPaletteResult {
  id: string;
  source_image: {
    filename: string;
    dimensions: { width: number; height: number };
    processed_at: string;
  };
  segments: SegmentInfo;
  palette: ExtractedColor[];
  exports: ExportFormats;
  metadata: ExtractionMetadata;
}

export interface ExtractionOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

// Extraction hooks for progress callbacks
export interface ExtractionHooks {
  onPartial?: (colors: ExtractedColor[]) => void;
}

// Service-level result types (different from segmentation types)
export interface ServiceSegmentationResult {
  foregroundMask: ForegroundMask | null;
  method: SegmentationMethod;
  quality: SegmentationQuality;
  usedFallback: boolean;
  confidence: number;
  categories: string[];
}

export interface ServicePixelExtractionResult {
  fgPixels: PixelData[];
  bgPixels: PixelData[];
  metadata: {
    width?: number;
    height?: number;
  };
}

export interface ServiceClusteringResult {
  dominantFgColors: Array<PixelData & { weight: number }>;
  dominantBgColors: Array<PixelData & { weight: number }>;
}
