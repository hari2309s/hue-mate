import type {
  ColorPaletteResult,
  ExtractedColor,
  RGBValues,
  SegmentInfo,
} from '@hue-und-you/types';
import { logger } from '../../../utils';
import { APP_CONFIG } from '../../../config';
import { performSegmentation, extractPixelsStage, performClustering } from './stages';
import {
  buildColorFormats,
  buildAccessibilityInfo,
  generateTintsAndShades,
  generateHarmonies,
  generateColorName,
  findNearestPantone,
  generateCssVariableName,
  resetPaletteNameTracker,
} from '../../color';
import { generateExports } from '../../export';
import { buildExtractionMetadata } from './metadata';

export interface ExtractionOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

export interface ExtractionHooks {
  onPartial?: (colors: ExtractedColor[]) => void;
}

async function buildExtractedColor(
  rgb: RGBValues,
  weight: number,
  segment: 'foreground' | 'background',
  index: number,
  genHarmonies: boolean
): Promise<ExtractedColor> {
  const formats = buildColorFormats(rgb);
  const oklch = formats.oklch.values;

  const colorName = generateColorName(rgb);

  const { tints, shades } = generateTintsAndShades(oklch, colorName);
  const harmony = genHarmonies ? generateHarmonies(oklch) : ({} as any);
  const accessibility = buildAccessibilityInfo(rgb);
  const pantone = findNearestPantone(rgb);

  const hsl = formats.hsl.values;
  const temperature =
    (hsl.h >= 0 && hsl.h <= 60) || (hsl.h >= 300 && hsl.h <= 360)
      ? ('warm' as const)
      : hsl.h >= 120 && hsl.h <= 240
        ? ('cool' as const)
        : ('neutral' as const);

  const color: ExtractedColor = {
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

  return color;
}

export async function extractColorsFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: ExtractionOptions = {},
  hooks: ExtractionHooks = {}
): Promise<ColorPaletteResult> {
  const { numColors, generateHarmonies: genHarm = true } = options;
  const processingStart = Date.now();
  let partialSent = false;

  logger.info('🎨 Starting Color Extraction Pipeline...');
  if (numColors) {
    logger.info(`User requested ${numColors} colors (will be used as target)`);
  } else {
    logger.info('No color count specified - using adaptive algorithm');
  }

  resetPaletteNameTracker();

  // STAGE 1: Segmentation
  logger.info('📐 Stage 1: Segmentation...');
  const segmentationResult = await performSegmentation(imageBuffer);

  // STAGE 2: Pixel Extraction
  logger.info('🎯 Stage 2: Pixel Extraction...');
  const { fgPixels, bgPixels, metadata } = await extractPixelsStage(
    imageBuffer,
    segmentationResult
  );

  // STAGE 3: Clustering (now with optional numColors)
  logger.info('🔬 Stage 3: Clustering...');
  const { dominantFgColors, dominantBgColors } = await performClustering(
    fgPixels,
    bgPixels,
    numColors
  );

  // STAGE 4: Color Naming & Formatting
  logger.info('🏷️  Stage 4: Color Naming...');
  const palette: ExtractedColor[] = [];
  let colorIndex = 1;

  const combinedDominant = [
    ...dominantFgColors.map((color) => ({ ...color, segment: 'foreground' as const })),
    ...dominantBgColors.map((color) => ({ ...color, segment: 'background' as const })),
  ].sort((a, b) => b.weight - a.weight);

  for (const colorData of combinedDominant) {
    const rgb: RGBValues = { r: colorData.r, g: colorData.g, b: colorData.b };
    const color = await buildExtractedColor(
      rgb,
      colorData.weight,
      colorData.segment,
      colorIndex++,
      genHarm
    );
    palette.push(color);

    if (!partialSent && palette.length >= APP_CONFIG.PARTIAL_COLOR_COUNT) {
      hooks.onPartial?.(palette.slice(0, APP_CONFIG.PARTIAL_COLOR_COUNT));
      partialSent = true;
    }
  }

  if (!partialSent && palette.length > 0) {
    hooks.onPartial?.(palette.slice(0, Math.min(APP_CONFIG.PARTIAL_COLOR_COUNT, palette.length)));
    partialSent = true;
  }

  logger.success(`✨ Extracted ${palette.length} unique colors`);

  // STAGE 5: Export Generation
  logger.info('📦 Stage 5: Generating exports...');
  const exports = generateExports(palette);

  // Build segment info
  const fgRatio = fgPixels.length / (fgPixels.length + bgPixels.length);
  const segmentInfo: SegmentInfo = {
    foreground: {
      pixel_percentage: segmentationResult.foregroundMask
        ? Math.round(segmentationResult.foregroundMask.foreground_percentage * 10) / 10
        : Math.round(fgRatio * 1000) / 10,
    },
    background: {
      pixel_percentage: segmentationResult.foregroundMask
        ? Math.round((100 - segmentationResult.foregroundMask.foreground_percentage) * 10) / 10
        : Math.round((1 - fgRatio) * 1000) / 10,
    },
    categories: segmentationResult.categories,
    method: segmentationResult.method,
    quality: segmentationResult.quality,
  };

  // Build extraction metadata
  const extractionMetadata = buildExtractionMetadata(palette, segmentationResult, processingStart);

  logger.success('✨ Pipeline Complete!');
  logger.info(`Colors: ${palette.map((c) => c.name).join(', ')}`);

  return {
    id: `palette_${Date.now()}`,
    source_image: {
      filename,
      dimensions: { width: metadata.width || 0, height: metadata.height || 0 },
      processed_at: new Date().toISOString(),
    },
    segments: segmentInfo,
    palette,
    exports,
    metadata: extractionMetadata,
  };
}
