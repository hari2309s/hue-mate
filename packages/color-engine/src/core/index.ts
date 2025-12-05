// ============================================================================
// SEGMENTATION
// ============================================================================

export {
  segmentForegroundBackground,
  segmentSemantic,
  extractPixels,
  splitPixelsByLuminance,
  classifySegment,
  FOREGROUND_LABELS,
  AMBIGUOUS_LABELS,
} from '../../../ml-segmentation/src/segmentation';

// ============================================================================
// COLOR PROCESSING
// ============================================================================

export {
  rgbToOklab,
  oklabToOklch,
  oklchToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsb,
  rgbToCmyk,
  rgbToLab,
  labToLch,
  buildColorFormats,
  kMeansClusteringOklab,
  applySaturationBias,
  deduplicateSimilarColors,
  finalCleanup,
  enforceHueDiversity,
  generateColorName,
  generateCssVariableName,
  findNearestPantone,
  resetPaletteNameTracker,
  getPaletteTracker,
  buildAccessibilityInfo,
  contrastRatio,
  buildContrastResult,
  calculateAPCA,
  generateTints,
  generateShades,
  generateTintsAndShades,
  generateHarmonies,
} from '@/core/color';

// ============================================================================
// EXPORT FORMATS
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
} from '@/core/export';

// ============================================================================
// EXTRACTION PIPELINE
// ============================================================================

export { extractColorsFromImage, buildExtractionMetadata } from '@/core/color/extraction';

export type {
  ExtractionOptions,
  ExtractionHooks,
  SegmentationResultData,
} from '@/core/color/extraction';
