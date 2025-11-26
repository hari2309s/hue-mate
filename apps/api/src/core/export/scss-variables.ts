import type { ExtractedColor } from '@hue-und-you/types';
import { deduplicateColors, buildColorScale, CSS_SCALE_STEPS } from './utils';

export function generateScssVariables(palette: ExtractedColor[]): string {
  const deduplicated = deduplicateColors(palette);

  return deduplicated
    .map((c) => {
      const name = c.name.toLowerCase().replace(/\s+/g, '-');
      const scale = buildColorScale(c);
      const lines = [`$${name}: ${scale['500']};`];
      CSS_SCALE_STEPS.forEach((step) => lines.push(`$${name}-${step}: ${scale[step]};`));
      return lines.join('\n');
    })
    .join('\n\n');
}
