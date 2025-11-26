import type { ExtractedColor, ExportFormats } from '@hue-und-you/types';
import { generateCssVariables } from './css-variables';
import { generateScssVariables } from './scss-variables';
import { generateTailwindConfig } from './tailwind-config';
import { generateFigmaTokens } from './figma-tokens';
import { generateSwiftCode } from './swift';
import { generateKotlinCode } from './kotlin';

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
