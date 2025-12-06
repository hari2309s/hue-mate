// Import from ml-segmentation package
export {
  segmentForegroundBackground,
  segmentSemantic,
  splitPixelsByLuminance,
  classifySegment,
  FOREGROUND_LABELS,
  AMBIGUOUS_LABELS,
} from '@hue-und-you/ml-segmentation';

// Export pixel extraction
export { extractPixels, extractPixelsMultiScale } from '@/core/segmentation/pixel-extraction';
