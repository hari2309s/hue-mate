import type { ExtractedColor } from './color';
import type { SegmentInfo, SegmentationMethod } from './segmentation';

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
