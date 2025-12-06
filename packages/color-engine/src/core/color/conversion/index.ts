// Export optimized versions as primary API
export {
  rgbToOklabCached as rgbToOklab,
  rgbToHslCached as rgbToHsl,
  oklchToRgbCached as oklchToRgb,
  rgbToHexFast as rgbToHex,
  batchRgbToOklab,
  batchRgbToHsl,
  clearConversionCaches,
  getConversionCacheStats,
} from '@/core/color/conversion/optimized';

// Export non-cached versions (these don't need optimization)
export { oklabToOklch } from '@/core/color/conversion/oklab';

// Re-export format builders
export {
  rgbToHsb,
  rgbToCmyk,
  rgbToLab,
  labToLch,
  buildColorFormats,
} from '@/core/color/conversion/formats';

// Export types
export type { OklabColor } from '@/types/segmentation';
