// Re-export all services
export { SegmentationService } from './SegmentationService';
export { PixelExtractionService } from './PixelExtractionService';
export { ClusteringService } from './ClusteringService';
export { ColorFormattingService } from './ColorFormattingService';
export { ExportService } from './ExportService';
export { MetadataService } from './MetadataService';

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
} from '../types';
