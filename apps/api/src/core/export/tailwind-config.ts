import type { ExtractedColor } from '@hue-und-you/types';
import { deduplicateColors, buildColorScale, CSS_SCALE_STEPS } from './utils';

export function generateTailwindConfig(palette: ExtractedColor[]): object {
  const deduplicated = deduplicateColors(palette);
  const colors: Record<string, Record<string, string>> = {};

  deduplicated.forEach((c) => {
    const name = c.name.toLowerCase().replace(/\s+/g, '-');
    const scale = buildColorScale(c);
    colors[name] = CSS_SCALE_STEPS.reduce(
      (acc, step) => {
        acc[step] = scale[step];
        return acc;
      },
      { DEFAULT: scale['500'] } as Record<string, string>
    );
  });

  return { theme: { extend: { colors } } };
}
