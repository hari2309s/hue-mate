import type { ColorPaletteResult } from '@hue-und-you/types';
import { colorExtractionOrchestrator } from './factory';
import type { ExtractionOptions, ExtractionHooks } from './types';

/**
 * Main entry point for color extraction.
 * Backward-compatible wrapper around the orchestrator.
 *
 * @param imageBuffer - Image data as Buffer
 * @param filename - Original filename
 * @param options - Extraction options (numColors, includeBackground, etc.)
 * @param hooks - Optional hooks for partial results
 * @returns Complete color palette result
 */
export async function extractColorsFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: ExtractionOptions = {},
  hooks: ExtractionHooks = {}
): Promise<ColorPaletteResult> {
  return colorExtractionOrchestrator.extract(imageBuffer, filename, options, hooks);
}
