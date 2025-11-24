import type { ExtractedColor, ExportFormats } from '@hue-und-you/types';

const CSS_SCALE_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

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
  const cssVars = palette
    .map((c) => {
      const scale = buildColorScale(c);
      const lines = [`  ${c.metadata.css_variable_name}: var(${c.metadata.css_variable_name}-500);`];
      CSS_SCALE_STEPS.forEach((step) => {
        lines.push(`  ${c.metadata.css_variable_name}-${step}: ${scale[step]};`);
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
  return palette
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
  const colors: Record<string, Record<string, string>> = {};

  palette.forEach((c) => {
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
  const tokens: Record<string, object> = {};

  palette.forEach((c) => {
    const name = c.name.toLowerCase().replace(/\s+/g, '-');
    tokens[name] = {
      value: c.formats.hex,
      type: 'color',
      description: `${c.name} from ${c.source.segment}`,
    };
  });

  return tokens;
}

// ============================================
// GENERATE SWIFT CODE
// ============================================

function generateSwiftCode(palette: ExtractedColor[]): string {
  const lines = ['import SwiftUI', '', 'extension Color {'];

  palette.forEach((c) => {
    const name = c.name.replace(/\s+/g, '');
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
  const lines = ['import androidx.compose.ui.graphics.Color', '', 'object AppColors {'];

  palette.forEach((c) => {
    const name = c.name.replace(/\s+/g, '');
    lines.push(`    val ${name} = Color(0xFF${c.formats.hex.slice(1)})`);
  });

  lines.push('}');
  return lines.join('\n');
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
