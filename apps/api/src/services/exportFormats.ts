import type { ExtractedColor, ExportFormats } from '@hue-und-you/types';

// ============================================
// GENERATE CSS VARIABLES
// ============================================

function generateCssVariables(palette: ExtractedColor[]): string {
  const cssVars = palette
    .map((c) => {
      const lines = [`  ${c.metadata.css_variable_name}: ${c.formats.hex};`];

      c.tints.forEach((t, i) =>
        lines.push(`  ${c.metadata.css_variable_name}-${(i + 1) * 100}: ${t.hex};`)
      );

      lines.push(`  ${c.metadata.css_variable_name}-500: ${c.formats.hex};`);

      c.shades.forEach((s, i) =>
        lines.push(`  ${c.metadata.css_variable_name}-${500 + (i + 1) * 100}: ${s.hex};`)
      );

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
      const lines = [`$${name}: ${c.formats.hex};`];

      c.tints.forEach((t, i) => lines.push(`$${name}-${(i + 1) * 100}: ${t.hex};`));

      c.shades.forEach((s, i) => lines.push(`$${name}-${500 + (i + 1) * 100}: ${s.hex};`));

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
    colors[name] = {
      50: c.tints[3]?.hex || c.formats.hex,
      100: c.tints[3]?.hex || c.formats.hex,
      200: c.tints[2]?.hex || c.formats.hex,
      300: c.tints[1]?.hex || c.formats.hex,
      400: c.tints[0]?.hex || c.formats.hex,
      500: c.formats.hex,
      600: c.shades[0]?.hex || c.formats.hex,
      700: c.shades[1]?.hex || c.formats.hex,
      800: c.shades[2]?.hex || c.formats.hex,
      900: c.shades[3]?.hex || c.formats.hex,
      DEFAULT: c.formats.hex,
    };
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
