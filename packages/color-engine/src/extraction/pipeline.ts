import type { ColorPaletteResult, ExtractionOptions, ExtractionHooks } from '@hute-mate/types';
import {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
} from './services';
import { ColorExtractionOrchestrator } from './orchestrator';

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
