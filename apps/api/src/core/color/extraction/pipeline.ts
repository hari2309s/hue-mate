/**
 * Color Extraction Pipeline
 *
 * Main entry point for color extraction.
 * Backward-compatible wrapper around the service container.
 *
 * @module color/extraction/pipeline
 */

import type { ColorPaletteResult } from '@hue-und-you/types';
import { services } from '../../../services/container';
import type { ExtractionOptions, ExtractionHooks } from './types';

/**
 * Extract colors from an image.
 *
 * This is the main entry point for color extraction. It orchestrates:
 * 1. Segmentation (foreground/background separation)
 * 2. Pixel sampling and extraction
 * 3. Color clustering using k-means
 * 4. Color formatting (names, formats, accessibility)
 * 5. Export generation (CSS, Tailwind, Figma, etc.)
 * 6. Metadata building
 *
 * @param imageBuffer - Image data as Buffer
 * @param filename - Original filename for metadata
 * @param options - Extraction options
 * @param hooks - Optional hooks for partial results (streaming)
 * @returns Complete color palette result
 *
 * @example
 * ```ts
 * import { extractColorsFromImage } from '@/core/color/extraction';
 *
 * const buffer = await fs.readFile('image.jpg');
 * const result = await extractColorsFromImage(buffer, 'image.jpg', {
 *   numColors: 10,
 *   includeBackground: true,
 *   generateHarmonies: true,
 * });
 *
 * console.log(`Extracted ${result.palette.length} colors`);
 * ```
 *
 * @example With streaming (partial results)
 * ```ts
 * const result = await extractColorsFromImage(
 *   buffer,
 *   'image.jpg',
 *   { numColors: 10 },
 *   {
 *     onPartial: (colors) => {
 *       console.log(`Got ${colors.length} colors so far...`);
 *       // Send to client via SSE, WebSocket, etc.
 *     }
 *   }
 * );
 * ```
 */
export async function extractColorsFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: ExtractionOptions = {},
  hooks: ExtractionHooks = {}
): Promise<ColorPaletteResult> {
  return services.orchestrator.extract(imageBuffer, filename, options, hooks);
}

/**
 * Get the orchestrator instance directly (for advanced usage)
 *
 * @example
 * ```ts
 * import { getOrchestrator } from '@/core/color/extraction';
 *
 * const orchestrator = getOrchestrator();
 * // Manually call individual stages if needed
 * ```
 */
export function getOrchestrator() {
  return services.orchestrator;
}
