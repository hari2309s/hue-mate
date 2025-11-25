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
import { buildColorFormats, rgbToHsl, rgbToOklab } from './colorConversion';
import { buildAccessibilityInfo } from './accessibility';
import {
  findNearestPantone,
  generateCssVariableName,
  generateColorName,
  resetPaletteNameTracker,
} from './colorNaming';
import { generateHarmonies, generateTintsAndShades } from './colorHarmony';
import { generateExports } from './exportFormats';
import { PixelWithWeight, SegmentResult } from '../types/segmentation';

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
  if (colors.length < 2) return 1.0;

  let totalDistance = 0;
  let count = 0;
  const distances: number[] = [];

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const c1 = colors[i].formats.oklch.values;
      const c2 = colors[j].formats.oklch.values;

      const dl = (c1.l - c2.l) * 100;
      const dc = (c1.c - c2.c) * 250;

      let dh = Math.abs(c1.h - c2.h);
      if (dh > 180) dh = 360 - dh;
      dh = dh * 1.5;

      const distance = Math.sqrt(dl * dl + dc * dc + dh * dh);

      distances.push(distance);
      totalDistance += distance;
      count++;
    }
  }

  const avgDistance = totalDistance / count;
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);

  console.log(
    `   → Color distances: min=${minDistance.toFixed(1)}, avg=${avgDistance.toFixed(1)}, max=${maxDistance.toFixed(1)}`
  );

  const normalized = Math.max(0, Math.min(1, (avgDistance - 40) / 60));
  return Math.round(normalized * 100) / 100;
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
    } else {
      const fgPct = foregroundMask.foreground_percentage;

      // IMPROVED: Better quality classification
      if (fgPct >= 5 && fgPct <= 70) {
        // Ideal range for most photos
        quality = 'high';
        confidence = 0.9;
      } else if (fgPct >= 1 && fgPct < 5) {
        // Small but valid foreground (architectural details, distant objects)
        quality = 'medium';
        confidence = 0.75;
        console.log('   ℹ Small foreground detected - may be architectural detail');
      } else if (fgPct > 70 && fgPct <= 90) {
        // Large foreground (close-ups, portraits)
        quality = 'medium';
        confidence = 0.8;
      } else {
        // Edge cases
        quality = 'low';
        confidence = 0.6;
        console.log('   ⚠ Unusual foreground percentage, segmentation may be unreliable');
      }
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

// IMPROVED: Multi-pass deduplication with final cleanup
function deduplicateSimilarColors(
  colors: PixelWithWeight[],
  minDistance: number = 0.4 // Increased from 0.35
): PixelWithWeight[] {
  if (colors.length === 0) return [];

  const unique: PixelWithWeight[] = [colors[0]];

  for (let i = 1; i < colors.length; i++) {
    const color = colors[i];
    const oklab = rgbToOklab(color.r, color.g, color.b);
    const hsl = rgbToHsl(color.r, color.g, color.b);

    let isTooSimilar = false;
    let closestIndex = -1;
    let minDist = Infinity;

    for (let j = 0; j < unique.length; j++) {
      const existingOklab = rgbToOklab(unique[j].r, unique[j].g, unique[j].b);
      const existingHsl = rgbToHsl(unique[j].r, unique[j].g, unique[j].b);

      // Calculate perceptual distance
      const dl = oklab.l - existingOklab.l;
      const da = oklab.a - existingOklab.a;
      const db = oklab.b - existingOklab.b;

      const perceptualDist = Math.sqrt(dl * dl * 1.5 + da * da * 6 + db * db * 6);

      // HSL checks
      let hueDiff = Math.abs(hsl.h - existingHsl.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;

      const satDiff = Math.abs(hsl.s - existingHsl.s);
      const lumDiff = Math.abs(hsl.l - existingHsl.l);

      // Determine effective threshold based on color characteristics
      const isNeutral = hsl.s < 20 || existingHsl.s < 20;
      const isVeryNeutral = hsl.s < 10 || existingHsl.s < 10;

      let effectiveThreshold = minDistance;

      if (isVeryNeutral) {
        // Very neutral: strict lightness requirement
        if (lumDiff < 18) {
          // Increased from 15
          isTooSimilar = true;
          closestIndex = j;
          break;
        }
        effectiveThreshold = minDistance * 0.7;
      } else if (isNeutral) {
        // Somewhat neutral: check both
        if (lumDiff < 12 && satDiff < 18) {
          // Stricter
          isTooSimilar = true;
          closestIndex = j;
          break;
        }
        effectiveThreshold = minDistance * 0.85;
      } else {
        // Saturated: strict hue separation
        if (hueDiff < 28 && satDiff < 22 && lumDiff < 18) {
          // Stricter
          isTooSimilar = true;
          closestIndex = j;
          break;
        }
      }

      if (perceptualDist < minDist) {
        minDist = perceptualDist;
        closestIndex = j;
      }

      if (perceptualDist < effectiveThreshold) {
        isTooSimilar = true;
        break;
      }
    }

    if (!isTooSimilar) {
      unique.push(color);
    } else if (closestIndex >= 0) {
      unique[closestIndex].weight += color.weight;
    }
  }

  return unique.sort((a, b) => b.weight - a.weight);
}

// NEW: Final cleanup pass to catch any stragglers
function finalCleanup(colors: PixelWithWeight[]): PixelWithWeight[] {
  if (colors.length <= 1) return colors;

  const cleaned: PixelWithWeight[] = [colors[0]];

  for (let i = 1; i < colors.length; i++) {
    const color = colors[i];
    const oklab = rgbToOklab(color.r, color.g, color.b);
    const hsl = rgbToHsl(color.r, color.g, color.b);

    let keepColor = true;
    let mergeIndex = -1;

    for (let j = 0; j < cleaned.length; j++) {
      const existing = cleaned[j];
      const existingOklab = rgbToOklab(existing.r, existing.g, existing.b);
      const existingHsl = rgbToHsl(existing.r, existing.g, existing.b);

      // Very strict final check
      const dl = oklab.l - existingOklab.l;
      const da = oklab.a - existingOklab.a;
      const db = oklab.b - existingOklab.b;
      const dist = Math.sqrt(dl * dl * 1.5 + da * da * 6 + db * db * 6);

      // If distance is less than 30 (extremely similar), merge
      if (dist < 0.3) {
        keepColor = false;
        mergeIndex = j;
        console.log(
          `   ⚠ Final cleanup: Merging very similar colors (distance: ${dist.toFixed(2)})`
        );
        break;
      }

      // Also check for near-identical hue/sat/lum
      let hueDiff = Math.abs(hsl.h - existingHsl.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;
      const satDiff = Math.abs(hsl.s - existingHsl.s);
      const lumDiff = Math.abs(hsl.l - existingHsl.l);

      if (hueDiff < 10 && satDiff < 10 && lumDiff < 10) {
        keepColor = false;
        mergeIndex = j;
        console.log(`   ⚠ Final cleanup: Merging near-identical colors (hue/sat/lum)`);
        break;
      }
    }

    if (keepColor) {
      cleaned.push(color);
    } else if (mergeIndex >= 0) {
      // Merge weights
      cleaned[mergeIndex].weight += color.weight;
    }
  }

  return cleaned.sort((a, b) => b.weight - a.weight);
}

function enforceHueDiversity(
  colors: PixelWithWeight[],
  minHueDifference: number = 35 // Increased from 30
): PixelWithWeight[] {
  if (colors.length === 0) return [];

  const diverse: PixelWithWeight[] = [colors[0]];

  for (let i = 1; i < colors.length; i++) {
    const color = colors[i];
    const hsl = rgbToHsl(color.r, color.g, color.b);

    // Skip very low saturation colors (neutrals) from hue check
    if (hsl.s < 12) {
      // But check if we already have a similar neutral
      let hasSimilarNeutral = false;

      for (const existing of diverse) {
        const existingHsl = rgbToHsl(existing.r, existing.g, existing.b);

        if (existingHsl.s < 12) {
          // Both are neutrals - check lightness difference
          const lumDiff = Math.abs(hsl.l - existingHsl.l);

          if (lumDiff < 20) {
            hasSimilarNeutral = true;
            break;
          }
        }
      }

      if (!hasSimilarNeutral) {
        diverse.push(color);
      }
      continue;
    }

    let hueTooSimilar = false;

    for (const existing of diverse) {
      const existingHsl = rgbToHsl(existing.r, existing.g, existing.b);

      // Skip if comparing with a neutral
      if (existingHsl.s < 12) continue;

      // Calculate hue difference (accounting for circular nature)
      let hueDiff = Math.abs(hsl.h - existingHsl.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;

      // Check saturation and lightness differences too
      const satDiff = Math.abs(hsl.s - existingHsl.s);
      const lumDiff = Math.abs(hsl.l - existingHsl.l);

      // IMPROVED: More nuanced similarity detection
      // Colors are too similar if:
      // - Very close hue AND similar saturation
      // - OR identical hue family with minimal sat/lum variation
      if (hueDiff < minHueDifference && satDiff < 25) {
        hueTooSimilar = true;
        break;
      }

      // Even stricter for nearly identical hues
      if (hueDiff < 15 && satDiff < 30 && lumDiff < 25) {
        hueTooSimilar = true;
        break;
      }
    }

    if (!hueTooSimilar) {
      diverse.push(color);
    }
  }

  return diverse;
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

  const biasedFgPixels = applySaturationBiasToPixels(fgPixels);
  const biasedBgPixels = applySaturationBiasToPixels(bgPixels);

  // Generate many candidates (4x requested)
  const rawFgColors =
    biasedFgPixels.length > 0 ? kMeansClusteringOklab(biasedFgPixels, fgColorCount * 4) : [];
  const rawBgColors =
    biasedBgPixels.length > 0 ? kMeansClusteringOklab(biasedBgPixels, bgColorCount * 4) : [];

  console.log(`   → Generated ${rawFgColors.length} FG + ${rawBgColors.length} BG candidates`);

  // Pass 1: Initial deduplication (more lenient)
  const dedupedFg = deduplicateSimilarColors(rawFgColors, 0.35);
  const dedupedBg = deduplicateSimilarColors(rawBgColors, 0.35);

  console.log(`   → After initial dedup: ${dedupedFg.length} FG + ${dedupedBg.length} BG`);

  // Pass 2: Hue diversity enforcement
  const diverseFg = enforceHueDiversity(dedupedFg, 35);
  const diverseBg = enforceHueDiversity(dedupedBg, 35);

  console.log(`   → After hue diversity: ${diverseFg.length} FG + ${diverseBg.length} BG`);

  // Pass 3: Slice to requested count
  const slicedFg = diverseFg.slice(0, fgColorCount);
  const slicedBg = diverseBg.slice(0, bgColorCount);

  // Pass 4: FINAL CLEANUP - catch any stragglers
  const dominantFgColors = finalCleanup(slicedFg);
  const dominantBgColors = finalCleanup(slicedBg);

  console.log(
    `   ✓ After final cleanup: ${dominantFgColors.length} FG + ${dominantBgColors.length} BG colors`
  );

  // If we lost too many colors in cleanup, we might need to grab more from the pool
  if (dominantFgColors.length < Math.min(2, fgColorCount)) {
    console.log('   → Insufficient FG colors after cleanup, adding from pool');
    const needed = Math.min(2, fgColorCount) - dominantFgColors.length;
    const additional = diverseFg
      .slice(fgColorCount, fgColorCount + needed + 2)
      .filter((candidate) => {
        // Only add if it's truly different from what we have
        return !dominantFgColors.some((existing) => {
          const oklab1 = rgbToOklab(candidate.r, candidate.g, candidate.b);
          const oklab2 = rgbToOklab(existing.r, existing.g, existing.b);
          const dl = oklab1.l - oklab2.l;
          const da = oklab1.a - oklab2.a;
          const db = oklab1.b - oklab2.b;
          return Math.sqrt(dl * dl + da * da * 6 + db * db * 6) < 0.4;
        });
      });
    dominantFgColors.push(...additional.slice(0, needed));
  }

  // Same for background
  if (dominantBgColors.length < Math.min(3, bgColorCount)) {
    console.log('   → Insufficient BG colors after cleanup, adding from pool');
    const needed = Math.min(3, bgColorCount) - dominantBgColors.length;
    const additional = diverseBg
      .slice(bgColorCount, bgColorCount + needed + 2)
      .filter((candidate) => {
        return !dominantBgColors.some((existing) => {
          const oklab1 = rgbToOklab(candidate.r, candidate.g, candidate.b);
          const oklab2 = rgbToOklab(existing.r, existing.g, existing.b);
          const dl = oklab1.l - oklab2.l;
          const da = oklab1.a - oklab2.a;
          const db = oklab1.b - oklab2.b;
          return Math.sqrt(dl * dl + da * da * 6 + db * db * 6) < 0.4;
        });
      });
    dominantBgColors.push(...additional.slice(0, needed));
  }

  console.log(
    `   ✓ Final palette: ${dominantFgColors.length} FG + ${dominantBgColors.length} BG colors`
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
