import type { ExtractedColor } from '@hue-und-you/types';

export const CSS_SCALE_STEPS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
];

export function deduplicateColors(palette: ExtractedColor[]): ExtractedColor[] {
  const seen = new Map<string, number>();

  return palette.map((color) => {
    const originalName = color.name;
    const count = seen.get(originalName) ?? 0;

    if (count > 0) {
      const newName = `${originalName} ${count + 1}`;
      seen.set(originalName, count + 1);
      return {
        ...color,
        name: newName,
        metadata: {
          ...color.metadata,
          css_variable_name: `--color-${newName.toLowerCase().replace(/\s+/g, '-')}`,
        },
      };
    }

    seen.set(originalName, 1);
    return color;
  });
}

export function buildColorScale(color: ExtractedColor): Record<string, string> {
  const { tints, shades } = color;
  const base = color.formats.hex;

  const safeTint = (indexFromLightest: number) => {
    const idx = tints.length - indexFromLightest;
    return tints[idx]?.hex ?? tints[tints.length - 1]?.hex ?? base;
  };

  const safeShade = (shadeIndex: number) => {
    return shades[shadeIndex]?.hex ?? shades[shades.length - 1]?.hex ?? base;
  };

  return {
    '50': safeTint(1),
    '100': safeTint(2),
    '200': safeTint(3),
    '300': safeTint(4),
    '400': tints[0]?.hex ?? base,
    '500': base,
    '600': safeShade(0),
    '700': safeShade(1),
    '800': safeShade(2),
    '900': safeShade(3),
    '950': safeShade(3),
  };
}
