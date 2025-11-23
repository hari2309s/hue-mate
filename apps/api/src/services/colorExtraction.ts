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
import { findNearestPantone, generateCssVariableName, type CategoryWithScore } from './colorNaming';
import { generateHarmonies, generateTintsAndShades } from './colorHarmony';
import { generateExports } from './exportFormats';
import {
  getContextualColorName,
  getBaseColorName,
  isOllamaAvailable,
} from './colorContextDetection';
import {
  generateColorUsageSuggestion,
  generateColorMood,
  generatePaletteDescription,
  classifyColorTemperature,
} from './aiEnhancedMetadata';

// ============================================
// EXTRACTION OPTIONS
// ============================================

interface ExtractionOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

// ============================================
// BUILD EXTRACTED COLOR (FULLY AI-POWERED)
// ============================================

async function buildExtractedColor(
  imageBase64: string,
  rgb: RGBValues,
  weight: number,
  segment: 'foreground' | 'background',
  categories: CategoryWithScore[],
  index: number,
  genHarmonies: boolean,
  useOllama: boolean,
  _allColors: ExtractedColor[] // For pairing suggestions
): Promise<ExtractedColor> {
  const formats = buildColorFormats(rgb);
  const hsl = formats.hsl.values;
  const oklch = formats.oklch.values;

  let colorName: string;
  let usedCategory: string;

  // AI-powered contextual naming
  if (useOllama && categories.length > 0) {
    const result = await getContextualColorName(imageBase64, rgb, categories);
    colorName = result.name;
    usedCategory = result.category;
  } else {
    colorName = getBaseColorName(rgb);
    usedCategory = 'general';
  }

  const { tints, shades } = generateTintsAndShades(oklch, colorName);
  const harmony = genHarmonies ? generateHarmonies(oklch) : ({} as ColorHarmony);
  const accessibility = buildAccessibilityInfo(rgb);
  const pantone = findNearestPantone(rgb);

  // AI-powered temperature classification
  const temperature = useOllama
    ? await classifyColorTemperature(imageBase64, rgb, colorName)
    : fallbackTemperature(hsl.h);

  // Create base color object
  const color: ExtractedColor = {
    id: `color_${String(index).padStart(3, '0')}`,
    name: colorName,
    source: {
      segment,
      category: usedCategory,
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

/**
 * Fallback temperature (simple hue-based)
 */
function fallbackTemperature(hue: number): 'warm' | 'cool' | 'neutral' {
  if ((hue >= 0 && hue <= 60) || (hue >= 300 && hue <= 360)) return 'warm';
  if (hue >= 120 && hue <= 240) return 'cool';
  return 'neutral';
}

// ============================================
// MAIN EXTRACTION PIPELINE (FULLY AI-POWERED)
// ============================================

export async function extractColorsFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: ExtractionOptions = {}
): Promise<ColorPaletteResult> {
  const { numColors = 5, generateHarmonies: genHarm = true } = options;

  console.log('🎨 Starting AI-Powered Color Extraction Pipeline...');

  // Check if Ollama is available
  const ollamaAvailable = await isOllamaAvailable();
  if (ollamaAvailable) {
    console.log('   ✓ Ollama AI available - full AI-powered mode enabled');
  } else {
    console.log('   ⚠ Ollama not available - using basic mode');
    console.log('   → Enable AI features: ollama pull llava-phi3');
  }

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

  const categoryScores: CategoryWithScore[] = segments.map((s) => ({
    label: s.label,
    score: s.score,
  }));

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
  // STAGE 4: AI-POWERED COLOR NAMING
  // ============================================
  console.log('🏷️  Stage 4: AI-Powered Color Naming...');

  const imageBase64 = imageBuffer.toString('base64');
  const palette: ExtractedColor[] = [];
  let colorIndex = 1;

  // Process foreground colors
  for (const colorData of dominantFgColors) {
    const rgb: RGBValues = { r: colorData.r, g: colorData.g, b: colorData.b };
    const color = await buildExtractedColor(
      imageBase64,
      rgb,
      colorData.weight,
      'foreground',
      categoryScores,
      colorIndex++,
      genHarm,
      ollamaAvailable,
      palette
    );
    palette.push(color);
  }

  // Process background colors
  for (const colorData of dominantBgColors) {
    const rgb: RGBValues = { r: colorData.r, g: colorData.g, b: colorData.b };
    const color = await buildExtractedColor(
      imageBase64,
      rgb,
      colorData.weight,
      'background',
      categoryScores,
      colorIndex++,
      genHarm,
      ollamaAvailable,
      palette
    );
    palette.push(color);
  }

  // ============================================
  // STAGE 5: AI-ENHANCED METADATA (NEW!)
  // ============================================
  if (ollamaAvailable) {
    console.log('✨ Stage 5: Generating AI-Enhanced Metadata...');

    // Generate usage suggestions and mood for each color
    for (const color of palette) {
      console.log(`   → Analyzing "${color.name}"...`);

      const [usage, mood] = await Promise.all([
        generateColorUsageSuggestion(imageBase64, color, palette),
        generateColorMood(imageBase64, color),
      ]);

      if (usage) (color as any).usage = usage;
      if (mood) (color as any).mood = mood;
    }

    console.log('   ✓ Generated usage suggestions and mood analysis');
  }

  // ============================================
  // STAGE 6: PALETTE-LEVEL DESCRIPTION (NEW!)
  // ============================================
  let paletteDescription = undefined;

  if (ollamaAvailable) {
    console.log('📝 Stage 6: Generating Palette Description...');
    paletteDescription = await generatePaletteDescription(imageBase64, palette, filename);
    if (paletteDescription) {
      console.log(`   ✓ "${paletteDescription.palette_description.slice(0, 60)}..."`);
    }
  }

  // ============================================
  // STAGE 7: EXPORT GENERATION
  // ============================================
  console.log('📦 Stage 7: Generating exports...');
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

  console.log('✨ AI-Powered Pipeline Complete!');
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
    description: paletteDescription,
  };
}
