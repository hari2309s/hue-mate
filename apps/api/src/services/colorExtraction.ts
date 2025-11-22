// apps/api/src/services/colorExtraction.ts

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
import { buildColorFormats, classifyTemperature } from './colorConversion';
import { buildAccessibilityInfo } from './accessibility';
import {
  getEnhancedColorName,
  findNearestPantone,
  generateCssVariableName,
  doesColorMatchCategory,
  type CategoryWithScore,
} from './colorNaming';
import { generateHarmonies, generateTintsAndShades } from './colorHarmony';
import { generateExports } from './exportFormats';

// ============================================
// EXTRACTION OPTIONS
// ============================================

interface ExtractionOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

// ============================================
// BUILD EXTRACTED COLOR
// ============================================

function buildExtractedColor(
  rgb: RGBValues,
  weight: number,
  segment: 'foreground' | 'background',
  category: string,
  index: number,
  genHarmonies: boolean
): ExtractedColor {
  const formats = buildColorFormats(rgb);
  const hsl = formats.hsl.values;
  const oklch = formats.oklch.values;

  // Only use category prefix if the color actually matches the category expectation
  const useCategory = doesColorMatchCategory(rgb, category) ? category : undefined;

  const colorName = getEnhancedColorName(rgb, useCategory);
  const { tints, shades } = generateTintsAndShades(oklch, colorName);
  const harmony = genHarmonies ? generateHarmonies(oklch) : ({} as ColorHarmony);
  const accessibility = buildAccessibilityInfo(rgb);
  const pantone = findNearestPantone(rgb);

  return {
    id: `color_${String(index).padStart(3, '0')}`,
    name: colorName,
    source: {
      segment,
      category: useCategory || 'general',
      pixel_coverage: weight,
      confidence: segment === 'foreground' ? 0.85 + weight * 0.15 : 0.75 + weight * 0.15,
    },
    formats,
    accessibility,
    tints,
    shades,
    harmony,
    metadata: {
      temperature: classifyTemperature(hsl.h),
      nearest_css_color: colorName.toLowerCase(),
      pantone_approximation: pantone,
      css_variable_name: generateCssVariableName(colorName),
    },
  };
}

// ============================================
// MAIN EXTRACTION PIPELINE
// ============================================

export async function extractColorsFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: ExtractionOptions = {}
): Promise<ColorPaletteResult> {
  const { numColors = 5, generateHarmonies: genHarm = true } = options;

  console.log('🎨 Starting Enhanced ML Color Extraction Pipeline...');

  // ============================================
  // STAGE 1a: FOREGROUND/BACKGROUND SEGMENTATION
  // ============================================
  console.log('📐 Stage 1a: Foreground/Background Segmentation...');
  const foregroundMask = await segmentForegroundBackground(imageBuffer);

  // ============================================
  // STAGE 1b: SEMANTIC SEGMENTATION
  // ============================================
  console.log('📊 Stage 1b: Semantic Segmentation (SegFormer)...');
  const segments = await segmentSemantic(imageBuffer);

  // Build categories with scores for filtering
  const categoriesWithScores: CategoryWithScore[] = segments.map((s) => ({
    label: s.label,
    score: s.score,
  }));

  const categories = segments.map((s) => s.label).filter(Boolean);
  if (categories.length > 0) {
    console.log(`   ✓ Identified ${categories.length} semantic regions: ${categories.join(', ')}`);
  }

  // ============================================
  // STAGE 2: IMAGE METADATA & PIXEL EXTRACTION
  // ============================================
  console.log('🎯 Stage 2: Pixel Extraction with Segmentation...');
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  console.log(`   ✓ Image: ${metadata.width}x${metadata.height} (${metadata.format})`);

  const { pixels, isForeground } = await extractPixels(imageBuffer, foregroundMask);
  console.log(`   ✓ Sampled ${pixels.length} pixels`);

  // Separate foreground and background pixels
  let fgPixels = pixels.filter((_, i) => isForeground[i]);
  let bgPixels = pixels.filter((_, i) => !isForeground[i]);

  // If no proper separation, split by luminance
  if (fgPixels.length === 0 || bgPixels.length === 0) {
    console.log('   → No mask available, splitting by luminance...');
    const split = splitPixelsByLuminance(pixels);
    fgPixels = split.foreground;
    bgPixels = split.background;
  }

  console.log(`   ✓ Foreground: ${fgPixels.length} pixels, Background: ${bgPixels.length} pixels`);

  // ============================================
  // STAGE 3: COLOR EXTRACTION (K-MEANS IN OKLCH)
  // ============================================
  console.log('🔬 Stage 3: K-means Clustering in OKLCH space...');

  const fgColorCount = Math.ceil(numColors * 0.6);
  const bgColorCount = Math.floor(numColors * 0.4);

  const dominantFgColors = fgPixels.length > 0 ? kMeansClusteringOklab(fgPixels, fgColorCount) : [];
  const dominantBgColors = bgPixels.length > 0 ? kMeansClusteringOklab(bgPixels, bgColorCount) : [];

  console.log(
    `   ✓ Extracted ${dominantFgColors.length} foreground + ${dominantBgColors.length} background colors`
  );

  // ============================================
  // STAGE 4: COLOR NAMING & ENRICHMENT
  // ============================================
  console.log('🏷️  Stage 4: Enhanced Color Naming & Metadata...');

  const palette: ExtractedColor[] = [];
  let colorIndex = 1;

  // Process foreground colors
  const fgCategory = segments[0]?.label || 'unknown';
  for (const colorData of dominantFgColors) {
    const rgb: RGBValues = { r: colorData.r, g: colorData.g, b: colorData.b };
    palette.push(
      buildExtractedColor(rgb, colorData.weight, 'foreground', fgCategory, colorIndex++, genHarm)
    );
  }

  // Process background colors
  const bgCategory = segments[segments.length - 1]?.label || 'unknown';
  for (const colorData of dominantBgColors) {
    const rgb: RGBValues = { r: colorData.r, g: colorData.g, b: colorData.b };
    palette.push(
      buildExtractedColor(rgb, colorData.weight, 'background', bgCategory, colorIndex++, genHarm)
    );
  }

  console.log('   ✓ Generated enhanced palette with context-aware names');

  // ============================================
  // STAGE 5: EXPORT GENERATION
  // ============================================
  console.log('📦 Stage 5: Generating exports...');
  const exports = generateExports(palette);

  const segmentInfo: SegmentInfo = {
    foreground: {
      pixel_percentage: foregroundMask
        ? Math.round(foregroundMask.foreground_percentage * 10) / 10
        : 50,
    },
    background: {
      pixel_percentage: foregroundMask
        ? Math.round((100 - foregroundMask.foreground_percentage) * 10) / 10
        : 50,
    },
    categories,
  };

  console.log('✨ Enhanced Pipeline Complete!');
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
