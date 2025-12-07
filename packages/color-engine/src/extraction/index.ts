export { extractColorsFromImage, getOrchestrator } from './pipeline';
export { ColorExtractionOrchestrator } from './orchestrator';
export {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
  buildExtractionMetadata,
} from './services';

// Re-export types from @hue-und-you/types
export type {
  ExtractionOptions,
  ServiceSegmentationResult as SegmentationResult,
  ServicePixelExtractionResult as PixelExtractionResult,
  ServiceClusteringResult as ClusteringResult,
} from '@hue-und-you/types';
export type { SegmentationMethod, SegmentationQuality } from '@hue-und-you/types';
export type { ExtractionHooks } from '@hue-und-you/types';
