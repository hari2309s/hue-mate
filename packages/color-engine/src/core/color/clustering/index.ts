// Export optimized K-means (replaces existing)
export { kMeansClusteringOklab } from '@/core/color/clustering/kmeans-optimized';

// Export optimized deduplication (replaces existing)
export {
  deduplicateSimilarColors,
  finalCleanup,
} from '@/core/color/clustering/deduplication-optimized';

// Export other clustering utilities (unchanged)
export { applySaturationBias } from '@/core/color/clustering/saturation-bias';
export { enforceHueDiversity } from '@/core/color/clustering/diversity';
