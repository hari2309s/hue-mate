// Re-export all services
export { SegmentationService } from '@/core/color/extraction/services/SegmentationService';
export { PixelExtractionService } from '@/core/color/extraction/services/PixelExtractionService';
export { ClusteringService } from '@/core/color/extraction/services/ClusteringService';
export { ColorFormattingService } from '@/core/color/extraction/services/ColorFormattingService';
export { ExportService } from '@/core/color/extraction/services/ExportService';
export { MetadataService } from '@/core/color/extraction/services/MetadataService';

// Re-export types (backwards compatibility)
export type {
  ISegmentationService,
  IPixelExtractionService,
  IClusteringService,
  IColorFormattingService,
  IExportService,
  IMetadataService,
  SegmentationResult,
  PixelExtractionResult,
  ClusteringResult,
  ClusteringOptions,
  ColorFormattingOptions,
  SegmentationMethod,
  SegmentationQuality,
} from '@/core/color/extraction/types';
