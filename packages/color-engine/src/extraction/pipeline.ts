import type { ColorPaletteResult } from '@hue-und-you/types';
import {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
  type ExtractionOptions,
} from './services';
import { ColorExtractionOrchestrator, type ExtractionHooks } from './orchestrator';

// Singleton services
let orchestratorInstance: ColorExtractionOrchestrator | null = null;

function getOrchestrator(): ColorExtractionOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ColorExtractionOrchestrator(
      new SegmentationService(),
      new PixelExtractionService(),
      new ClusteringService(),
      new ColorFormattingService(),
      new ExportService(),
      new MetadataService()
    );
  }
  return orchestratorInstance;
}

export async function extractColorsFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: ExtractionOptions = {},
  hooks: ExtractionHooks = {}
): Promise<ColorPaletteResult> {
  return getOrchestrator().extract(imageBuffer, filename, options, hooks);
}

export { getOrchestrator };
