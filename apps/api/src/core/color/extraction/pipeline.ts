import type { ColorPaletteResult } from '@hue-und-you/types';
import { colorExtractionOrchestrator } from './factory';
import type { ExtractionOptions, ExtractionHooks } from './ColorExtractionOrchestrator';

/**
 * Backward-compatible wrapper around the new orchestrator.
 * Maintains the same API for existing code.
 */
export async function extractColorsFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: ExtractionOptions = {},
  hooks: ExtractionHooks = {}
): Promise<ColorPaletteResult> {
  return colorExtractionOrchestrator.extract(imageBuffer, filename, options, hooks);
}

export type { ExtractionOptions, ExtractionHooks };
