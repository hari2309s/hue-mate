import type { RGBValues, ExtractedColor } from '@hue-und-you/types';
import {
  buildColorFormats,
  buildAccessibilityInfo,
  generateTintsAndShades,
  generateHarmonies,
  generateColorName,
  findNearestPantone,
  generateCssVariableName,
  resetPaletteNameTracker,
} from '../../../color';
import type { IColorFormattingService, ColorFormattingOptions } from '../types';

export class ColorFormattingService implements IColorFormattingService {
  async format(
    rgb: RGBValues,
    weight: number,
    segment: 'foreground' | 'background',
    index: number,
    options?: ColorFormattingOptions
  ): Promise<ExtractedColor> {
    const formats = buildColorFormats(rgb);
    const oklch = formats.oklch.values;

    const colorName = generateColorName(rgb);
    const { tints, shades } = generateTintsAndShades(oklch, colorName);
    const harmony = options?.generateHarmonies !== false ? generateHarmonies(oklch) : ({} as any);
    const accessibility = buildAccessibilityInfo(rgb);
    const pantone = findNearestPantone(rgb);

    const hsl = formats.hsl.values;
    const temperature =
      (hsl.h >= 0 && hsl.h <= 60) || (hsl.h >= 300 && hsl.h <= 360)
        ? ('warm' as const)
        : hsl.h >= 120 && hsl.h <= 240
          ? ('cool' as const)
          : ('neutral' as const);

    return {
      id: `color_${String(index).padStart(3, '0')}`,
      name: colorName,
      source: {
        segment,
        category: 'general',
        pixel_coverage: weight,
        confidence: segment === 'foreground' ? 0.85 + weight * 0.15 : 0.75 + weight * 0.15,
      },
      formats,
      accessibility,
      tints,
      shades,
      harmony,
      metadata: {
        temperature,
        nearest_css_color: colorName.toLowerCase(),
        pantone_approximation: pantone,
        css_variable_name: generateCssVariableName(colorName),
      },
    };
  }

  resetNameTracker(): void {
    resetPaletteNameTracker();
  }
}
