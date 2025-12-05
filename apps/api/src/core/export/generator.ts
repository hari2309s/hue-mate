import type { ExtractedColor, ExportFormats } from '@hue-und-you/types';
import { generateCssVariables } from '@/core/export/css-variables';
import { generateScssVariables } from '@/core/export/scss-variables';
import { generateTailwindConfig } from '@/core/export/tailwind-config';
import { generateFigmaTokens } from '@/core/export/figma-tokens';
import { generateSwiftCode } from '@/core/export/swift';
import { generateKotlinCode } from '@/core/export/kotlin';

export function generateExports(palette: ExtractedColor[]): ExportFormats {
  return {
    css_variables: generateCssVariables(palette),
    scss_variables: generateScssVariables(palette),
    tailwind_config: generateTailwindConfig(palette),
    figma_tokens: generateFigmaTokens(palette),
    swift: generateSwiftCode(palette),
    kotlin: generateKotlinCode(palette),
  };
}
