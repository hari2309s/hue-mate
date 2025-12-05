export * from './config';
export * from './utils';
export * from './types/segmentation';
export * from './core';
export * from './services';

// Explicit exports for config
export { config, validateConfig, printConfigSummary } from './config';

export {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
} from './core/color/extraction/services';

export { ColorExtractionOrchestrator } from './core/color/extraction/ColorExtractionOrchestrator';
export type {
  ISegmentationService,
  IPixelExtractionService,
  IClusteringService,
  IColorFormattingService,
  IExportService,
  IMetadataService,
} from './core/color/extraction/types';
