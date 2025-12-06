import type { RGBValues, HSLValues } from '@hue-und-you/types';
import { rgbToHsl } from '@/conversion';
import {
  NEUTRAL_THRESHOLD,
  EARTH_SAT_THRESHOLD,
  NEUTRAL_NAMES,
  EARTH_TONES,
  getHuePalette,
  getToneBucket,
  type ToneBucket,
} from './palettes';
import { getPaletteTracker } from './palette-tracker';

function sanitizeColorName(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
  return sanitized.length > 0 ? sanitized : 'Color';
}

function isNeutralColor(hsl: HSLValues): boolean {
  if (hsl.s <= NEUTRAL_THRESHOLD) return true;
  if (hsl.s <= 18 && (hsl.l <= 25 || hsl.l >= 85)) return true;
  return false;
}

function isEarthyTone(hsl: HSLValues): boolean {
  return hsl.s <= EARTH_SAT_THRESHOLD && hsl.s >= 10 && hsl.h >= 20 && hsl.h <= 70;
}

function getIntensityDescriptor(
  saturation: number,
  lightness: number,
  tone: ToneBucket
): string | null {
  if (saturation <= 15) {
    if (tone === 'light') return 'Soft';
    if (tone === 'dark') return 'Deep';
    return 'Muted';
  }

  if (saturation <= 30) {
    return null;
  }

  if (saturation >= 75) {
    if (lightness >= 50 && lightness <= 75) {
      return 'Vivid';
    } else if (lightness > 85) {
      return 'Bright';
    } else if (lightness < 30) {
      return 'Deep';
    }
    return null;
  }

  if (saturation >= 50) {
    if (tone === 'dark' && lightness < 30) return 'Rich';
    if (tone === 'light' && lightness > 80) return 'Luminous';
    return null;
  }

  if (saturation >= 35) {
    if (tone === 'dark' && lightness < 25) return 'Dusky';
    return null;
  }

  return null;
}

function hasConflictingDescriptor(baseName: string, descriptor: string): boolean {
  const lowerBase = baseName.toLowerCase();
  const lowerDesc = descriptor.toLowerCase();

  if (lowerBase.includes(lowerDesc)) return true;

  const conflicts: Record<string, string[]> = {
    vivid: ['muted', 'dusky', 'soft', 'pale', 'deep'],
    muted: ['vivid', 'bright', 'luminous'],
    deep: ['bright', 'luminous', 'soft', 'pale'],
    bright: ['deep', 'dusky', 'muted'],
    luminous: ['deep', 'dusky', 'muted'],
    soft: ['vivid', 'deep'],
    pale: ['vivid', 'deep'],
  };

  const conflictWords = conflicts[lowerDesc] || [];
  for (const conflict of conflictWords) {
    if (lowerBase.includes(conflict)) return true;
  }

  const descriptorWords = [
    'glow',
    'gleam',
    'ember',
    'flame',
    'blaze',
    'burst',
    'haze',
    'mist',
    'drift',
    'veil',
    'shadow',
    'night',
    'dawn',
    'dusk',
    'light',
    'dark',
    'bright',
  ];

  for (const word of descriptorWords) {
    if (lowerBase.includes(word)) {
      return true;
    }
  }

  return false;
}

function finalizeName(base: string, descriptor: string | null): string {
  if (!descriptor) return sanitizeColorName(base);

  if (hasConflictingDescriptor(base, descriptor)) {
    return sanitizeColorName(base);
  }

  return sanitizeColorName(`${descriptor} ${base}`);
}

export function generateColorName(rgb: RGBValues): string {
  const tracker = getPaletteTracker();
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const tone = getToneBucket(hsl.l, hsl.s);

  const seed = Math.round(hsl.h * 17 + hsl.s * 13 + hsl.l * 11);

  if (isNeutralColor(hsl)) {
    const name = tracker.pickName(NEUTRAL_NAMES, tone, seed, 'neutral');
    tracker.markUsed(name);
    return sanitizeColorName(name);
  }

  if (isEarthyTone(hsl)) {
    const name = tracker.pickName(EARTH_TONES, tone, seed, 'earth');
    tracker.markUsed(name);
    return sanitizeColorName(name);
  }

  const palette = getHuePalette(hsl.h);
  const base = tracker.pickName(palette.names, tone, seed, palette.family.toLowerCase());
  const rawDescriptor = getIntensityDescriptor(hsl.s, hsl.l, tone);
  const descriptor = tracker.pickDescriptor(rawDescriptor, base);

  const finalName = finalizeName(base, descriptor);
  tracker.markUsed(finalName);
  return finalName;
}

export function generateCssVariableName(colorName: string): string {
  const sanitized = colorName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

  return `--color-${sanitized || 'unknown'}`;
}
