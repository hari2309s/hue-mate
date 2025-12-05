import type { ExtractedColor, ExtractionMetadata } from '@hue-und-you/types';

export function computeColorDiversity(colors: ExtractedColor[]): number {
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

export function computeColorSeparation(colors: ExtractedColor[]): number {
  if (colors.length < 2) return 1.0;

  let totalDistance = 0;
  let count = 0;

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

      totalDistance += distance;
      count++;
    }
  }

  const avgDistance = totalDistance / count;
  const normalized = Math.max(0, Math.min(1, (avgDistance - 40) / 60));
  return Math.round(normalized * 100) / 100;
}

export function resolveDominantTemperature(colors: ExtractedColor[]): 'warm' | 'cool' | 'neutral' {
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

export function buildSuggestedUsage(
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

export interface SegmentationResultData {
  foregroundMask: any;
  method: 'mask2former' | 'segformer' | 'fallback-luminance';
  quality: 'high' | 'medium' | 'low';
  usedFallback: boolean;
  confidence: number;
  categories: string[];
}

export function buildExtractionMetadata(
  palette: ExtractedColor[],
  segmentationResult: SegmentationResultData,
  processingStartTime: number
): ExtractionMetadata {
  const colorDiversity = computeColorDiversity(palette);
  const colorSeparation = computeColorSeparation(palette);
  const averageSaturation =
    palette.reduce((sum, color) => sum + color.formats.hsl.values.s, 0) /
    Math.max(palette.length, 1);
  const dominantTemperature = resolveDominantTemperature(palette);

  const uniqueNames = new Set(palette.map((c) => c.name));
  const namingQuality = uniqueNames.size / palette.length;

  return {
    processingTimeMs: Date.now() - processingStartTime,
    colorCount: palette.length,
    algorithm: 'weighted-kmeans',
    colorDiversity,
    averageSaturation: Math.round(averageSaturation),
    dominantTemperature,
    suggestedUsage: buildSuggestedUsage(dominantTemperature, colorDiversity, averageSaturation),
    segmentationQuality: {
      method: segmentationResult.method,
      confidence:
        segmentationResult.quality === 'high'
          ? 'high'
          : segmentationResult.quality === 'medium'
            ? 'medium'
            : 'low',
      foregroundDetected: !!segmentationResult.foregroundMask && !segmentationResult.usedFallback,
      usedFallback: segmentationResult.usedFallback,
    },
    extractionConfidence: {
      overall:
        Math.round(((segmentationResult.confidence + colorSeparation + namingQuality) / 3) * 100) /
        100,
      colorSeparation: Math.round(colorSeparation * 100) / 100,
      namingQuality: Math.round(namingQuality * 100) / 100,
    },
  };
}
