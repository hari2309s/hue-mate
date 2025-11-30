import {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
} from './services';
import { ColorExtractionOrchestrator } from './ColorExtractionOrchestrator';

/**
 * Factory function for creating a configured orchestrator with all dependencies.
 * Makes it easy to swap implementations for testing or different configurations.
 */
export function createColorExtractionOrchestrator(): ColorExtractionOrchestrator {
  const segmentationService = new SegmentationService();
  const pixelExtractionService = new PixelExtractionService();
  const clusteringService = new ClusteringService();
  const colorFormattingService = new ColorFormattingService();
  const exportService = new ExportService();
  const metadataService = new MetadataService();

  return new ColorExtractionOrchestrator(
    segmentationService,
    pixelExtractionService,
    clusteringService,
    colorFormattingService,
    exportService,
    metadataService
  );
}

/**
 * Singleton instance for convenience.
 * Use createColorExtractionOrchestrator() for tests with mocks.
 */
export const colorExtractionOrchestrator = createColorExtractionOrchestrator();
