import sharp from 'sharp';
import type {
  ColorPaletteResult,
  ExtractedColor,
  SegmentInfo,
  RGBValues,
  ColorHarmony,
  ExtractionMetadata,
} from '@hue-und-you/types';

// Import modular services
import {
  segmentForegroundBackground,
  segmentSemantic,
  extractPixels,
  splitPixelsByLuminance,
} from './segmentation';
import { kMeansClusteringOklab, applySaturationBias } from './clustering';
import { buildColorFormats } from './colorConversion';
import { buildAccessibilityInfo } from './accessibility';
import {
  findNearestPantone,
  generateCssVariableName,
  generateColorName,
  resetPaletteNameTracker,
} from './colorNaming';
import { generateHarmonies, generateTintsAndShades } from './colorHarmony';
import { generateExports } from './exportFormats';
import { SegmentResult } from '../types/segmentation';

interface ExtractionHooks {
  onPartial?: (colors: ExtractedColor[]) => void;
}

const PARTIAL_COLOR_COUNT = 5;

interface ExtractionOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

interface SegmentationResult {
  foregroundMask: any;
  method: 'mask2former' | 'fallback-luminance';
  quality: 'high' | 'medium' | 'low';
  usedFallback: boolean;
  confidence: number;
}

function applySaturationBiasToPixels(pixels: { r: number; g: number; b: number }[]): RGBValues[] {
  return applySaturationBias(pixels) as RGBValues[];
}

function computeColorDiversity(colors: ExtractedColor[]): number {
  if (colors.length === 0) return 0;
  const weights = colors.map((c) => Math.max(c.source.pixel_coverage, 0));
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const entropy = weights.reduce((sum, weight) => {
    const p = weight / total;
    return p > 0 ? sum - p * Math.log(p) : sum;
  }, 0);
  const normalized = colors.length > 1 ? entropy / Math.log(colors.length) : 0;
  return Number(Math.max(0, Math.min(1, normalized)).toFixed(2));
}

function computeColorSeparation(colors: ExtractedColor[]): number {
  // Calculate average distance between colors in OKLCH space
  if (colors.length < 2) return 1.0;

  let totalDistance = 0;
  let count = 0;

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const c1 = colors[i].formats.oklch.values;
      const c2 = colors[j].formats.oklch.values;

      const dl = c1.l - c2.l;
      const dc = c1.c - c2.c;
      const dh = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));

      const distance = Math.sqrt(dl * dl + dc * dc + (dh / 360) * (dh / 360));
      totalDistance += distance;
      count++;
    }
  }

  const avgDistance = totalDistance / count;
  // Normalize to 0-1 range (assuming max meaningful distance is ~2)
  return Math.min(1.0, avgDistance / 2.0);
}

function resolveDominantTemperature(colors: ExtractedColor[]): 'warm' | 'cool' | 'neutral' {
  const tally = colors.reduce(
    (acc, color) => {
      acc[color.metadata.temperature] += 1;
      return acc;
    },
    { warm: 0, cool: 0, neutral: 0 }
  );
  return (
    (Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] as 'warm' | 'cool' | 'neutral') ??
    'neutral'
  );
}

function buildSuggestedUsage(
  dominantTemperature: 'warm' | 'cool' | 'neutral',
  colorDiversity: number,
  averageSaturation: number
): string {
  if (averageSaturation >= 65) {
    return 'Vibrant palette for energetic, expressive designs';
  }
  if (dominantTemperature === 'cool') {
    return colorDiversity >= 0.7
      ? 'Professional, calming palette with rich accents'
      : 'Minimal, cool-toned palette';
  }
  if (dominantTemperature === 'warm') {
    return 'Inviting palette ideal for lifestyle or hospitality brands';
  }
  return colorDiversity >= 0.7
    ? 'Versatile palette for modern interfaces'
    : 'Balanced palette for everyday use';
}

async function performSegmentation(imageBuffer: Buffer): Promise<SegmentationResult> {
  let foregroundMask = null;
  let usedFallback = false;
  let method: 'mask2former' | 'fallback-luminance' = 'mask2former';
  let quality: 'high' | 'medium' | 'low' = 'high';
  let confidence = 0.9;

  try {
    foregroundMask = await segmentForegroundBackground(imageBuffer);

    if (!foregroundMask) {
      console.log('   ⚠ Segmentation returned null, using fallback');
      usedFallback = true;
      method = 'fallback-luminance';
      quality = 'medium';
      confidence = 0.5;
    } else if (
      foregroundMask.foreground_percentage < 5 ||
      foregroundMask.foreground_percentage > 95
    ) {
      console.log('   ⚠ Extreme foreground percentage, segmentation may be unreliable');
      quality = 'low';
      confidence = 0.6;
    }
  } catch (error) {
    console.log(
      `   ⚠ Segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    usedFallback = true;
    method = 'fallback-luminance';
    quality = 'low';
    confidence = 0.4;
  }

  return { foregroundMask, method, quality, usedFallback, confidence };
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

  // Temperature based on hue
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
  const { numColors = 10, generateHarmonies: genHarm = true } = options;
  const processingStart = Date.now();
  let partialSent = false;

  console.log('🎨 Starting Color Extraction Pipeline...');

  // Reset the palette name tracker for this extraction
  resetPaletteNameTracker();

  // ============================================
  // STAGE 1: SEGMENTATION (WITH QUALITY TRACKING)
  // ============================================
  console.log('📐 Stage 1a: Foreground/Background Segmentation...');
  const segmentationResult = await performSegmentation(imageBuffer);
  const { foregroundMask, method, quality, usedFallback, confidence } = segmentationResult;

  console.log(`   ℹ Segmentation: method=${method}, quality=${quality}, confidence=${confidence}`);

  console.log('📊 Stage 1b: Semantic Segmentation...');
  let segments: SegmentResult[] = [];

  try {
    segments = await segmentSemantic(imageBuffer);
  } catch (error) {
    console.log(
      `   ⚠ Semantic segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

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

  // Fallback: if segmentation didn't work well, use luminance-based split
  if (fgPixels.length === 0 || bgPixels.length === 0 || fgPixels.length < pixels.length * 0.05) {
    if (fgPixels.length === 0 || bgPixels.length === 0) {
      console.log('   ⚠ Using luminance-based fallback split');
    }
    const split = splitPixelsByLuminance(pixels);
    fgPixels = split.foreground;
    bgPixels = split.background;
  }

  console.log(
    `   ✓ Foreground: ${Math.round((fgPixels.length / pixels.length) * 100)}% | Background: ${Math.round((bgPixels.length / pixels.length) * 100)}%`
  );

  // ============================================
  // STAGE 3: COLOR CLUSTERING (WITH IMPROVED SATURATION BIAS)
  // ============================================
  console.log('🔬 Stage 3: K-means Clustering in OKLCH space...');

  const fgRatio = fgPixels.length / pixels.length;
  const fgColorCount = Math.max(1, Math.round(numColors * fgRatio));
  const bgColorCount = Math.max(1, numColors - fgColorCount);

  // Apply improved saturation boosting
  const biasedFgPixels = applySaturationBiasToPixels(fgPixels);
  const biasedBgPixels = applySaturationBiasToPixels(bgPixels);

  const dominantFgColors =
    biasedFgPixels.length > 0 ? kMeansClusteringOklab(biasedFgPixels, fgColorCount) : [];
  const dominantBgColors =
    biasedBgPixels.length > 0 ? kMeansClusteringOklab(biasedBgPixels, bgColorCount) : [];

  console.log(
    `   ✓ Extracted ${dominantFgColors.length} foreground + ${dominantBgColors.length} background colors`
  );

  // ============================================
  // STAGE 4: COLOR NAMING
  // ============================================
  console.log('🏷️  Stage 4: Generating Color Names...');

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
      genHarm,
      palette
    );
    palette.push(color);
    if (!partialSent && palette.length >= PARTIAL_COLOR_COUNT) {
      hooks.onPartial?.(palette.slice(0, PARTIAL_COLOR_COUNT));
      partialSent = true;
    }
  }
  if (!partialSent && palette.length > 0) {
    hooks.onPartial?.(palette.slice(0, Math.min(PARTIAL_COLOR_COUNT, palette.length)));
    partialSent = true;
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
    method,
    quality,
  };

  console.log('✨ Pipeline Complete!');
  console.log(`Colors: ${palette.map((c) => c.name).join(', ')}`);

  // ============================================
  // STAGE 6: METADATA CALCULATION
  // ============================================
  const colorDiversity = computeColorDiversity(palette);
  const colorSeparation = computeColorSeparation(palette);
  const averageSaturation =
    palette.reduce((sum, color) => sum + color.formats.hsl.values.s, 0) /
    Math.max(palette.length, 1);
  const dominantTemperature = resolveDominantTemperature(palette);

  // Calculate naming quality (based on diversity and no duplicates)
  const uniqueNames = new Set(palette.map((c) => c.name));
  const namingQuality = uniqueNames.size / palette.length;

  const extractionMetadata: ExtractionMetadata = {
    processingTimeMs: Date.now() - processingStart,
    algorithm: 'weighted-kmeans',
    colorDiversity,
    averageSaturation: Math.round(averageSaturation),
    dominantTemperature,
    suggestedUsage: buildSuggestedUsage(dominantTemperature, colorDiversity, averageSaturation),
    segmentationQuality: {
      method,
      confidence: quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low',
      foregroundDetected: !!foregroundMask && !usedFallback,
      usedFallback,
    },
    extractionConfidence: {
      overall: Math.round(((confidence + colorSeparation + namingQuality) / 3) * 100) / 100,
      colorSeparation: Math.round(colorSeparation * 100) / 100,
      namingQuality: Math.round(namingQuality * 100) / 100,
    },
  };

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
