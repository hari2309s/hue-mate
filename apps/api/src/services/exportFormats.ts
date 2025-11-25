import type { ExtractedColor, ExportFormats } from '@hue-und-you/types';

const CSS_SCALE_STEPS = [
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

// ============================================
// DEDUPLICATE COLORS BY NAME
// ============================================

function deduplicateColors(palette: ExtractedColor[]): ExtractedColor[] {
  const seen = new Map<string, number>();

  return palette.map((color, _index) => {
    const originalName = color.name;
    const count = seen.get(originalName) ?? 0;

    if (count > 0) {
      // Append occurrence number to duplicate names
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

// ============================================
// BUILD COLOR SCALE (11 steps)
// ============================================

function buildColorScale(color: ExtractedColor): Record<string, string> {
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

// ============================================
// GENERATE CSS VARIABLES
// ============================================

function generateCssVariables(palette: ExtractedColor[]): string {
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

// ============================================
// GENERATE SCSS VARIABLES
// ============================================

function generateScssVariables(palette: ExtractedColor[]): string {
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

// ============================================
// GENERATE TAILWIND CONFIG
// ============================================

function generateTailwindConfig(palette: ExtractedColor[]): object {
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

// ============================================
// GENERATE FIGMA TOKENS
// ============================================

function generateFigmaTokens(palette: ExtractedColor[]): object {
  const deduplicated = deduplicateColors(palette);
  const tokens: Record<string, object> = {};

  deduplicated.forEach((c) => {
    const name = c.name.toLowerCase().replace(/\s+/g, '-');
    tokens[name] = {
      value: c.formats.hex,
      type: 'color',
      description: `${c.name} - ${c.metadata.temperature} tone`,
    };
  });

  return { tokens };
}

// ============================================
// GENERATE SWIFT CODE
// ============================================

function generateSwiftCode(palette: ExtractedColor[]): string {
  const deduplicated = deduplicateColors(palette);
  const lines = ['import SwiftUI', '', 'extension Color {'];

  deduplicated.forEach((c) => {
    const name = c.name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const { r, g, b } = c.formats.rgb.values;
    lines.push(
      `    static let ${name} = Color(red: ${(r / 255).toFixed(3)}, green: ${(g / 255).toFixed(3)}, blue: ${(b / 255).toFixed(3)})`
    );
  });

  lines.push('}');
  return lines.join('\n');
}

// ============================================
// GENERATE KOTLIN CODE
// ============================================

function generateKotlinCode(palette: ExtractedColor[]): string {
  const deduplicated = deduplicateColors(palette);
  const lines = ['import androidx.compose.ui.graphics.Color', '', 'object AppColors {'];

  deduplicated.forEach((c) => {
    const name = c.name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    lines.push(`    val ${name} = Color(0xFF${c.formats.hex.slice(1)})`);
  });

  lines.push('}');
  return lines.join('\n');
}

// ============================================
// GENERATE JSON EXPORT
// ============================================

function generateJsonExport(palette: ExtractedColor[]): string {
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

// ============================================
// GENERATE ALL EXPORT FORMATS
// ============================================

export function generateExports(palette: ExtractedColor[]): ExportFormats {
  return {
    css_variables: generateCssVariables(palette),
    tailwind_config: generateTailwindConfig(palette),
    figma_tokens: generateFigmaTokens(palette),
    scss_variables: generateScssVariables(palette),
    swift: generateSwiftCode(palette),
    kotlin: generateKotlinCode(palette),
  };
}

export function generateJsonExportString(palette: ExtractedColor[]): string {
  return generateJsonExport(palette);
}
