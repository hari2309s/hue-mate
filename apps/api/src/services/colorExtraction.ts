import sharp from 'sharp';
import type {
  ColorPaletteResult,
  ExtractedColor,
  SegmentInfo,
  RGBValues,
  ColorHarmony,
} from '@hue-und-you/types';

// Import modular services
import {
  segmentForegroundBackground,
  segmentSemantic,
  extractPixels,
  splitPixelsByLuminance,
} from './segmentation';
import { kMeansClusteringOklab } from './clustering';
import { buildColorFormats } from './colorConversion';
import { buildAccessibilityInfo } from './accessibility';
import { findNearestPantone, generateCssVariableName, generateColorName } from './colorNaming';
import { generateHarmonies, generateTintsAndShades } from './colorHarmony';
import { generateExports } from './exportFormats';

interface ExtractionOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

async function buildExtractedColor(
  rgb: RGBValues,
  weight: number,
  segment: 'foreground' | 'background',
  index: number,
  genHarmonies: boolean,
  _allColors: ExtractedColor[]
): Promise<ExtractedColor> {
  const formats = buildColorFormats(rgb);
  const oklch = formats.oklch.values;

  // Generate color name using heuristic palette
  const colorName = generateColorName(rgb);

  const { tints, shades } = generateTintsAndShades(oklch, colorName);
  const harmony = genHarmonies ? generateHarmonies(oklch) : ({} as ColorHarmony);
  const accessibility = buildAccessibilityInfo(rgb);
  const pantone = findNearestPantone(rgb);

  // Simple fallback temperature based on hue
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
  options: ExtractionOptions = {}
): Promise<ColorPaletteResult> {
  const { numColors = 10, generateHarmonies: genHarm = true } = options;

  console.log('🎨 Starting Color Extraction Pipeline...');

  // ============================================
  // STAGE 1: SEGMENTATION
  // ============================================
  console.log('📐 Stage 1a: Foreground/Background Segmentation...');
  const foregroundMask = await segmentForegroundBackground(imageBuffer);

  console.log('📊 Stage 1b: Semantic Segmentation...');
  const segments = await segmentSemantic(imageBuffer);

  const categories = segments.map((s) => s.label).filter(Boolean);
  if (categories.length > 0) {
    console.log(`   ✓ Identified ${categories.length} semantic regions: ${categories.join(', ')}`);
  }

  // ============================================
  // STAGE 2: PIXEL EXTRACTION
  // ============================================
  console.log('🎯 Stage 2: Pixel Extraction...');
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const { pixels, isForeground } = await extractPixels(imageBuffer, foregroundMask);
  console.log(`   ✓ Sampled ${pixels.length} pixels`);

  let fgPixels = pixels.filter((_, i) => isForeground[i]);
  let bgPixels = pixels.filter((_, i) => !isForeground[i]);

  if (fgPixels.length === 0 || bgPixels.length === 0 || fgPixels.length < pixels.length * 0.05) {
    const split = splitPixelsByLuminance(pixels);
    fgPixels = split.foreground;
    bgPixels = split.background;
  }

  // ============================================
  // STAGE 3: COLOR CLUSTERING
  // ============================================
  console.log('🔬 Stage 3: K-means Clustering in OKLCH space...');

  const fgRatio = fgPixels.length / pixels.length;
  const fgColorCount = Math.max(1, Math.round(numColors * fgRatio));
  const bgColorCount = Math.max(1, numColors - fgColorCount);

  const dominantFgColors = fgPixels.length > 0 ? kMeansClusteringOklab(fgPixels, fgColorCount) : [];
  const dominantBgColors = bgPixels.length > 0 ? kMeansClusteringOklab(bgPixels, bgColorCount) : [];

  console.log(
    `   ✓ Extracted ${dominantFgColors.length} foreground + ${dominantBgColors.length} background colors`
  );

  // ============================================
  // STAGE 4: COLOR NAMING
  // ============================================
  console.log('🏷️  Stage 4: Generating Color Names...');

  const palette: ExtractedColor[] = [];
  let colorIndex = 1;

  // Process foreground colors
  for (const colorData of dominantFgColors) {
    const rgb: RGBValues = { r: colorData.r, g: colorData.g, b: colorData.b };
    const color = await buildExtractedColor(
      rgb,
      colorData.weight,
      'foreground',
      colorIndex++,
      genHarm,
      palette
    );
    palette.push(color);
  }

  // Process background colors
  for (const colorData of dominantBgColors) {
    const rgb: RGBValues = { r: colorData.r, g: colorData.g, b: colorData.b };
    const color = await buildExtractedColor(
      rgb,
      colorData.weight,
      'background',
      colorIndex++,
      genHarm,
      palette
    );
    palette.push(color);
  }

  // ============================================
  // STAGE 5: EXPORT GENERATION
  // ============================================
  console.log('📦 Stage 5: Generating exports...');
  const exports = generateExports(palette);

  const segmentInfo: SegmentInfo = {
    foreground: {
      pixel_percentage: foregroundMask
        ? Math.round(foregroundMask.foreground_percentage * 10) / 10
        : Math.round(fgRatio * 1000) / 10,
    },
    background: {
      pixel_percentage: foregroundMask
        ? Math.round((100 - foregroundMask.foreground_percentage) * 10) / 10
        : Math.round((1 - fgRatio) * 1000) / 10,
    },
    categories,
  };

  console.log('✨ Pipeline Complete!');
  console.log(`   Colors: ${palette.map((c) => c.name).join(', ')}`);

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
  };
}
