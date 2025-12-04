/**
 * Color Extraction System
 *
 * A modular, service-based architecture for extracting color palettes from images.
 * Uses dependency injection for testability and follows SOLID principles.
 *
 * @module color/extraction
 */

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Main extraction function - use this for most cases
 */
export { extractColorsFromImage } from './pipeline';

/**
 * Orchestrator for advanced usage with custom hooks
 */
export { ColorExtractionOrchestrator } from './ColorExtractionOrchestrator';

/**
 * Factory function and singleton instance
 */
export { createColorExtractionOrchestrator, colorExtractionOrchestrator } from './factory';

// ============================================================================
// TYPES
// ============================================================================

/**
 * All service interfaces and types
 */
export type {
  // Service interfaces
  ISegmentationService,
  IPixelExtractionService,
  IClusteringService,
  IColorFormattingService,
  IExportService,
  IMetadataService,

  // Result types
  SegmentationResult,
  PixelExtractionResult,
  ClusteringResult,

  // Options
  ExtractionOptions,
  ExtractionHooks,
  ClusteringOptions,
  ColorFormattingOptions,

  // Enums
  SegmentationMethod,
  SegmentationQuality,
} from './types';

// ============================================================================
// SERVICES
// ============================================================================

/**
 * Default service implementations
 */
export {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
} from './services';

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Metadata builder utility
 *
 * @deprecated Use MetadataService.build() instead
 */
export { buildExtractionMetadata } from './metadata';

/**
 * Legacy type for backwards compatibility
 *
 * @deprecated Use SegmentationResult from types instead
 */
export type { SegmentationResultData } from './metadata';
