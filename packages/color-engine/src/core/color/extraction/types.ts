import type { ForegroundMask, PixelData } from '@/types/segmentation';
import type {
  ExtractedColor,
  ExportFormats,
  ExtractionMetadata,
  RGBValues,
} from '@hue-und-you/types';

// ============================================================================
// SEGMENTATION
// ============================================================================

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

// ============================================================================
// PIXEL EXTRACTION
// ============================================================================

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

// ============================================================================
// CLUSTERING
// ============================================================================

export interface ClusteringResult {
  dominantFgColors: Array<PixelData & { weight: number }>;
  dominantBgColors: Array<PixelData & { weight: number }>;
}

export interface ClusteringOptions {
  numColors?: number;
}

export interface IClusteringService {
  cluster(
    fgPixels: PixelData[],
    bgPixels: PixelData[],
    options?: ClusteringOptions
  ): Promise<ClusteringResult>;
}

// ============================================================================
// COLOR FORMATTING
// ============================================================================

export interface ColorFormattingOptions {
  generateHarmonies?: boolean;
}

export interface IColorFormattingService {
  format(
    rgb: RGBValues,
    weight: number,
    segment: 'foreground' | 'background',
    index: number,
    options?: ColorFormattingOptions
  ): Promise<ExtractedColor>;

  resetNameTracker(): void;
}

// ============================================================================
// EXPORT & METADATA
// ============================================================================

export interface IExportService {
  generate(palette: ExtractedColor[]): ExportFormats;
}

export interface IMetadataService {
  build(
    palette: ExtractedColor[],
    segmentation: SegmentationResult,
    processingStartTime: number
  ): ExtractionMetadata;
}

// ============================================================================
// EXTRACTION OPTIONS & HOOKS
// ============================================================================

export interface ExtractionOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

export interface ExtractionHooks {
  onPartial?: (colors: ExtractedColor[]) => void;
}
