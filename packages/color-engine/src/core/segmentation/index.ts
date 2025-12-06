export { segmentForegroundBackground } from '@/core/segmentation/foreground-background';
export { segmentSemantic } from '@/core/segmentation/semantic';

// Export optimized pixel extraction (replaces existing)
export {
  extractPixels,
  extractPixelsMultiScale,
} from '@/core/segmentation/pixel-extraction-optimized';

export { splitPixelsByLuminance } from '@/core/segmentation/fallback';
export {
  classifySegment,
  FOREGROUND_LABELS,
  AMBIGUOUS_LABELS,
} from '@/core/segmentation/classification';
