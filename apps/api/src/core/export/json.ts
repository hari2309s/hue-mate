import type { ExtractedColor } from '@hue-und-you/types';
import { deduplicateColors, buildColorScale } from './utils';

export function generateJsonExport(palette: ExtractedColor[]): string {
  const deduplicated = deduplicateColors(palette);

  const jsonData = {
    name: 'Extracted Color Palette',
    colors: deduplicated.map((c) => {
      const scale = buildColorScale(c);
      return {
        name: c.name,
        hex: c.formats.hex,
        rgb: c.formats.rgb.values,
        oklch: c.formats.oklch.values,
        temperature: c.metadata.temperature,
        contrast: {
          on_white: c.accessibility.contrast_on_white.ratio,
          on_black: c.accessibility.contrast_on_black.ratio,
        },
        scale: {
          50: scale['50'],
          100: scale['100'],
          200: scale['200'],
          300: scale['300'],
          400: scale['400'],
          500: scale['500'],
          600: scale['600'],
          700: scale['700'],
          800: scale['800'],
          900: scale['900'],
          950: scale['950'],
        },
      };
    }),
  };

  return JSON.stringify(jsonData, null, 2);
}
