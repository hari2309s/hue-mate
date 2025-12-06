// Extraction Pipeline (Main API)
export { extractColorsFromImage, ColorExtractionOrchestrator } from './extraction';

// Services
export {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
} from './extraction';

// Types
export type {
  ExtractionOptions,
  ExtractionHooks,
  SegmentationResult,
  PixelExtractionResult,
  ClusteringResult,
  SegmentationMethod,
  SegmentationQuality,
} from './extraction';

// ============================================================================
// CONVERSION
// ============================================================================

export {
  rgbToOklab,
  rgbToHsl,
  oklchToRgb,
  rgbToHex,
  oklabToOklch,
  batchRgbToOklab,
  batchRgbToHsl,
  clearConversionCaches,
  getConversionCacheStats,
  rgbToHsb,
  rgbToCmyk,
  rgbToLab,
  labToLch,
  buildColorFormats,
} from './conversion';

// ============================================================================
// CLUSTERING
// ============================================================================

export {
  kMeansClusteringOklab,
  applySaturationBias,
  deduplicateSimilarColors,
  finalCleanup,
  enforceHueDiversity,
} from './clustering';

// ============================================================================
// NAMING
// ============================================================================

export {
  generateColorName,
  generateCssVariableName,
  findNearestPantone,
  resetPaletteNameTracker,
  getPaletteTracker,
} from './naming';

export type { PaletteToneMap, ToneBucket, HuePalette } from './naming';

// ============================================================================
// ACCESSIBILITY
// ============================================================================

export {
  buildAccessibilityInfo,
  contrastRatio,
  buildContrastResult,
  calculateAPCA,
} from './accessibility';

// ============================================================================
// HARMONY
// ============================================================================

export {
  generateTints,
  generateShades,
  generateTintsAndShades,
  generateHarmonies,
} from './harmony';

// ============================================================================
// EXPORT
// ============================================================================

export {
  generateExports,
  generateCssVariables,
  generateScssVariables,
  generateTailwindConfig,
  generateFigmaTokens,
  generateSwiftCode,
  generateKotlinCode,
  generateJsonExport,
  deduplicateColors,
  buildColorScale,
  CSS_SCALE_STEPS,
} from './export';

// ============================================================================
// FORMATTING
// ============================================================================

export { formatColor, type ColorFormattingOptions } from './formatting';

// ============================================================================
// ML SEGMENTATION (Re-export)
// ============================================================================

export {
  segmentForegroundBackground,
  segmentSemantic,
  extractPixels,
  extractPixelsMultiScale,
  splitPixelsByLuminance,
  classifySegment,
} from '@hue-und-you/ml-segmentation';
