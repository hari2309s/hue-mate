import type { ExtractedColor } from '@hute-mate/types';

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

  const safeTint = (index: number) => {
    if (index < 0 || index >= tints.length) return base;
    return tints[index].hex;
  };

  const safeShade = (index: number) => {
    if (index < 0 || index >= shades.length) return base;
    return shades[index].hex;
  };

  const scale = {
    '50': safeTint(0),
    '100': safeTint(1),
    '200': safeTint(2),
    '300': safeTint(3),
    '400': safeTint(4),
    '500': base,
    '600': safeShade(0),
    '700': safeShade(1),
    '800': safeShade(2),
    '900': safeShade(3),
    '950': safeShade(4),
  };

  // Validation
  const values = Object.values(scale);
  const uniqueValues = new Set(values);

  if (uniqueValues.size !== 11) {
    console.warn(
      `[buildColorScale] Warning: Only ${uniqueValues.size}/11 unique colors for ${color.name}`
    );
  }

  return scale;
}
