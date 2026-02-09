// ============================================================================
// EXTRACTION PIPELINE (Main API)
// ============================================================================
export { extractColorsFromImage, ColorExtractionOrchestrator } from './extraction';

// ============================================================================
// SERVICES
// ============================================================================
export {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
} from './extraction';

// ============================================================================
// RE-EXPORT TYPES FROM @hute-mate/types
// ============================================================================
export type {
  // Extraction
  ExtractionOptions,
  ExtractionHooks,
  ServiceSegmentationResult as SegmentationResult,
  ServicePixelExtractionResult as PixelExtractionResult,
  ServiceClusteringResult as ClusteringResult,

  // Segmentation
  SegmentationMethod,
  SegmentationQuality,
  SegmentResult,
  ForegroundMask,
  PixelData,
  PixelWithWeight,
  PixelWithOklab,
  ExtractedPixels,
  SegmentInfo,

  // Color
  RGBValues,
  OKLCHValues,
  HSLValues,
  HSBValues,
  CMYKValues,
  LABValues,
  LCHValues,
  OklabColor,
  ColorFormats,
  ContrastResult,
  APCAResult,
  AccessibilityInfo,
  TintShade,
  HarmonyColor,
  ColorHarmony,
  ColorTemperature,
  ColorMetadata,
  ColorSource,
  ExtractedColor,
  ToneBucket,
  PaletteToneMap,
  HuePalette,
  ColorFormattingOptions,

  // Result
  ColorPaletteResult,
  ExtractionMetadata,
  ExportFormats,
} from '@hute-mate/types';

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
export { formatColor } from './formatting';

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
} from '@hute-mate/ml-segmentation';
