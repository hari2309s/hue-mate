import type { ExtractedColor } from '@hue-und-you/types';
import { deduplicateColors, buildColorScale, CSS_SCALE_STEPS } from './utils';

export function generateCssVariables(palette: ExtractedColor[]): string {
  const deduplicated = deduplicateColors(palette);

  const cssVars = deduplicated
    .map((c) => {
      const scale = buildColorScale(c);
      const varName = c.metadata.css_variable_name;
      const lines = [`  ${varName}: var(${varName}-500);`];
      CSS_SCALE_STEPS.forEach((step) => {
        lines.push(`  ${varName}-${step}: ${scale[step]};`);
      });
      return lines.join('\n');
    })
    .join('\n\n');

  return `:root {\n${cssVars}\n}`;
}
