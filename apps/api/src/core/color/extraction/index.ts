/**
 * Color Extraction System
 *
 * A modular, service-based architecture for extracting color palettes from images.
 * Uses dependency injection for testability and follows SOLID principles.
 *
 * @module color/extraction
 */

export { extractColorsFromImage } from './pipeline';

/**
 * Options for color extraction
 */
export type { ExtractionOptions, ExtractionHooks } from './ColorExtractionOrchestrator';

export { ColorExtractionOrchestrator } from './ColorExtractionOrchestrator';

/**
 * Factory function to create a fully configured orchestrator
 */
export { createColorExtractionOrchestrator } from './factory';

/**
 * Singleton orchestrator instance (recommended for most use cases)
 */
export { colorExtractionOrchestrator } from './factory';

// ============================================================================
// SERVICE INTERFACES - For Custom Implementations
// ============================================================================

/**
 * Service interface for image segmentation (foreground/background separation)
 */
export type { ISegmentationService } from './interfaces/ISegmentationService';

/**
 * Result type from segmentation service
 */
export type { SegmentationResult } from './interfaces/ISegmentationService';

/**
 * Segmentation method type
 */
export type { SegmentationMethod } from './interfaces/ISegmentationService';

/**
 * Segmentation quality type
 */
export type { SegmentationQuality } from './interfaces/ISegmentationService';

/**
 * Service interface for pixel extraction from images
 */
export type { IPixelExtractionService } from './interfaces/IPixelExtractionService';

/**
 * Result type from pixel extraction service
 */
export type { PixelExtractionResult } from './interfaces/IPixelExtractionService';

/**
 * Service interface for color clustering
 */
export type { IClusteringService } from './interfaces/IClusteringService';

/**
 * Result type from clustering service
 */
export type { ClusteringResult } from './interfaces/IClusteringService';

/**
 * Options for clustering service
 */
export type { ClusteringOptions } from './interfaces/IClusteringService';

/**
 * Service interface for color formatting and naming
 */
export type { IColorFormattingService } from './interfaces/IColorFormattingService';

/**
 * Options for color formatting service
 */
export type { ColorFormattingOptions } from './interfaces/IColorFormattingService';

/**
 * Service interface for generating export formats
 */
export type { IExportService } from './interfaces/IExportService';

/**
 * Service interface for building extraction metadata
 */
export type { IMetadataService } from './interfaces/IMetadataService';

// ============================================================================
// SERVICE IMPLEMENTATIONS - Default Implementations
// ============================================================================

/**
 * Default segmentation service implementation
 * Uses Mask2Former and SegFormer models with luminance fallback
 */
export { SegmentationService } from './services/SegmentationService';

/**
 * Default pixel extraction service implementation
 * Samples and classifies pixels based on segmentation
 */
export { PixelExtractionService } from './services/PixelExtractionService';

/**
 * Default clustering service implementation
 * Uses k-means++ in OKLab color space
 */
export { ClusteringService } from './services/ClusteringService';

/**
 * Default color formatting service implementation
 * Converts colors to all formats and generates names
 */
export { ColorFormattingService } from './services/ColorFormattingService';

/**
 * Default export service implementation
 * Generates CSS, Tailwind, Figma, Swift, Kotlin exports
 */
export { ExportService } from './services/ExportService';

/**
 * Default metadata service implementation
 * Calculates extraction quality metrics
 */
export { MetadataService } from './services/MetadataService';

// ============================================================================
// UTILITIES - Helper Functions
// ============================================================================

/**
 * Build extraction metadata from palette and segmentation results
 *
 * @deprecated Use MetadataService.build() instead
 */
export { buildExtractionMetadata } from './metadata';

/**
 * Type definition for segmentation result data
 *
 * @deprecated Use SegmentationResult from interfaces instead
 */
export type { SegmentationResultData } from './metadata';
