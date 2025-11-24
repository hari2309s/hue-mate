// Main extraction pipeline
export { extractColorsFromImage } from './colorExtraction';

// Segmentation services
export {
  segmentForegroundBackground,
  segmentSemantic,
  extractPixels,
  splitPixelsByLuminance,
} from './segmentation';

// Color conversion utilities
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
} from './colorConversion';

// Clustering
export { kMeansClusteringOklab } from './clustering';

// Accessibility
export { buildAccessibilityInfo } from './accessibility';

// Color naming
export {
  findNearestPantone,
  generateCssVariableName,
  type CategoryWithScore,
  generateColorName,
} from './colorNaming';

// Color harmony
export {
  generateHarmonies,
  generateTints,
  generateShades,
  generateTintsAndShades,
} from './colorHarmony';

// Export formats
export { generateExports } from './exportFormats';

