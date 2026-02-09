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

// Re-export types from @hute-mate/types
export type {
  ExtractionOptions,
  ServiceSegmentationResult as SegmentationResult,
  ServicePixelExtractionResult as PixelExtractionResult,
  ServiceClusteringResult as ClusteringResult,
} from '@hute-mate/types';
export type { SegmentationMethod, SegmentationQuality } from '@hute-mate/types';
export type { ExtractionHooks } from '@hute-mate/types';
