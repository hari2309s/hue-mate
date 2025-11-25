import type { RGBValues, HSLValues } from '@hue-und-you/types';
import { rgbToHsl } from './colorConversion';

// ============================================
// PANTONE COLOR DATABASE (subset)
// ============================================

const PANTONE_COLORS = [
  { name: 'PANTONE 18-1664 TCX Flame Scarlet', rgb: { r: 205, g: 33, b: 42 } },
  { name: 'PANTONE 18-1663 TCX Fiery Red', rgb: { r: 206, g: 41, b: 57 } },
  { name: 'PANTONE 19-1664 TCX Racing Red', rgb: { r: 193, g: 35, b: 48 } },
  { name: 'PANTONE 15-1264 TCX Living Coral', rgb: { r: 250, g: 114, b: 104 } },
  { name: 'PANTONE 17-1564 TCX Burnt Sienna', rgb: { r: 165, g: 82, b: 63 } },
  { name: 'PANTONE 18-1438 TCX Autumn Maple', rgb: { r: 194, g: 80, b: 51 } },
  { name: 'PANTONE 16-1449 TCX Tangerine', rgb: { r: 250, g: 106, b: 56 } },
  { name: 'PANTONE 15-1333 TCX Apricot', rgb: { r: 236, g: 145, b: 92 } },
  { name: 'PANTONE 14-1064 TCX Peach', rgb: { r: 255, g: 183, b: 135 } },
  { name: 'PANTONE 13-0942 TCX Lemon', rgb: { r: 253, g: 214, b: 99 } },
  { name: 'PANTONE 14-0756 TCX Mustard', rgb: { r: 214, g: 170, b: 61 } },
  { name: 'PANTONE 15-0751 TCX Golden Glow', rgb: { r: 234, g: 170, b: 0 } },
  { name: 'PANTONE 19-0622 TCX Olive', rgb: { r: 86, g: 86, b: 57 } },
  { name: 'PANTONE 18-0426 TCX Forest', rgb: { r: 67, g: 86, b: 54 } },
  { name: 'PANTONE 15-6442 TCX Mint', rgb: { r: 152, g: 212, b: 187 } },
  { name: 'PANTONE 17-5641 TCX Teal', rgb: { r: 0, g: 128, b: 128 } },
  { name: 'PANTONE 18-5025 TCX Deep Teal', rgb: { r: 26, g: 95, b: 90 } },
  { name: 'PANTONE 19-4056 TCX Blue Depths', rgb: { r: 42, g: 72, b: 88 } },
  { name: 'PANTONE 18-4051 TCX Mosaic Blue', rgb: { r: 0, g: 114, b: 155 } },
  { name: 'PANTONE 17-4041 TCX Aqua', rgb: { r: 100, g: 200, b: 215 } },
  { name: 'PANTONE 19-4052 TCX Classic Blue', rgb: { r: 15, g: 76, b: 129 } },
  { name: 'PANTONE 18-3949 TCX Purple', rgb: { r: 104, g: 69, b: 114 } },
  { name: 'PANTONE 18-3633 TCX Magenta', rgb: { r: 208, g: 65, b: 126 } },
  { name: 'PANTONE 19-2428 TCX Wine', rgb: { r: 114, g: 47, b: 55 } },
  { name: 'PANTONE 19-1420 TCX Chocolate', rgb: { r: 92, g: 58, b: 38 } },
  { name: 'PANTONE 19-1015 TCX Coffee', rgb: { r: 78, g: 59, b: 47 } },
  { name: 'PANTONE 11-0601 TCX White', rgb: { r: 244, g: 244, b: 242 } },
  { name: 'PANTONE 19-0303 TCX Black', rgb: { r: 40, g: 40, b: 40 } },
];

// ============================================
// CATEGORY WITH SCORE TYPE (for semantic segmentation)
// ============================================

export interface CategoryWithScore {
  label: string;
  score: number;
}

// ============================================
// FIND NEAREST PANTONE COLOR
// ============================================

export function findNearestPantone(rgb: RGBValues): string {
  let minDistance = Infinity;
  let nearestPantone = 'PANTONE N/A';

  for (const pantone of PANTONE_COLORS) {
    const distance = Math.sqrt(
      Math.pow(rgb.r - pantone.rgb.r, 2) +
        Math.pow(rgb.g - pantone.rgb.g, 2) +
        Math.pow(rgb.b - pantone.rgb.b, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestPantone = pantone.name;
    }
  }

  return nearestPantone;
}

// ============================================
// GENERATE CSS VARIABLE NAME
// ============================================

export function generateCssVariableName(colorName: string): string {
  return `--color-${colorName.toLowerCase().replace(/\s+/g, '-')}`;
}

// ============================================
// COLOR NAMING SYSTEM
// ============================================

type ToneBucket = 'dark' | 'medium' | 'light';

interface PaletteToneMap {
  dark: string[];
  medium: string[];
  light: string[];
}

interface HuePalette {
  family: string;
  range: [number, number];
  names: PaletteToneMap;
}

const NEUTRAL_THRESHOLD = 12;
const EARTH_SAT_THRESHOLD = 45;

const NEUTRAL_NAMES: PaletteToneMap = {
  dark: ['Obsidian Ash', 'Charcoal Drift', 'Inkstone Gray', 'Shadow Slate', 'Steel Night'],
  medium: ['Fogbound Slate', 'Dove Feather', 'Silver Haze', 'Stone Mist', 'Ash Cloud'],
  light: ['Pearl Mist', 'Cloud Linen', 'Frosted Ivory', 'Moonlit Silk', 'Vapor White'],
};

const EARTH_TONES: PaletteToneMap = {
  dark: ['Roasted Umber', 'Espresso Soil', 'Chestnut Bark', 'Mahogany Shadow', 'Coffee Bean'],
  medium: ['Copper Canyon', 'Amber Clay', 'Russet Trail', 'Terra Sienna', 'Canyon Stone'],
  light: ['Sandstone Glow', 'Golden Wheat', 'Honey Dust', 'Desert Sand', 'Warm Linen'],
};

const HUE_PALETTES: HuePalette[] = [
  {
    family: 'Crimson',
    range: [345, 20],
    names: {
      dark: ['Garnet', 'Merlot', 'Burgundy', 'Wine Red', 'Ruby'],
      medium: ['Scarlet', 'Cherry', 'Vermilion', 'Cardinal', 'Poppy'],
      light: ['Rose', 'Coral', 'Blush', 'Pink', 'Salmon'],
    },
  },
  {
    family: 'Copper',
    range: [20, 45],
    names: {
      dark: ['Copper', 'Burnt Sienna', 'Rust', 'Bronze', 'Clay'],
      medium: ['Tangerine', 'Persimmon', 'Pumpkin', 'Terracotta', 'Autumn'],
      light: ['Apricot', 'Peach', 'Coral', 'Melon', 'Cantaloupe'],
    },
  },
  {
    family: 'Solar',
    range: [45, 75],
    names: {
      dark: ['Amber', 'Goldenrod', 'Ochre', 'Bronze', 'Honey'],
      medium: ['Sunflower', 'Citrine', 'Marigold', 'Saffron', 'Gold'],
      light: ['Lemon', 'Butter', 'Champagne', 'Cream', 'Vanilla'],
    },
  },
  {
    family: 'Lime',
    range: [75, 110],
    names: {
      dark: ['Olive', 'Moss', 'Forest', 'Jade', 'Hunter'],
      medium: ['Lime', 'Chartreuse', 'Grass', 'Sage', 'Kiwi'],
      light: ['Celery', 'Mint', 'Pistachio', 'Spring', 'Tea'],
    },
  },
  {
    family: 'Verdant',
    range: [110, 150],
    names: {
      dark: ['Pine', 'Spruce', 'Evergreen', 'Jungle', 'Emerald'],
      medium: ['Meadow', 'Fern', 'Clover', 'Kelly', 'Grass'],
      light: ['Mint', 'Seafoam', 'Celadon', 'Sage', 'Laurel'],
    },
  },
  {
    family: 'Emerald',
    range: [150, 185],
    names: {
      dark: ['Teal', 'Jade', 'Viridian', 'Malachite', 'Cypress'],
      medium: ['Emerald', 'Turquoise', 'Caribbean', 'Tropical', 'Aquamarine'],
      light: ['Seafoam', 'Aqua', 'Mint', 'Sea Glass', 'Foam'],
    },
  },
  {
    family: 'Lagoon',
    range: [185, 210],
    names: {
      dark: ['Teal', 'Cyan', 'Ocean', 'Peacock', 'Marine'],
      medium: ['Lagoon', 'Aqua', 'Turquoise', 'Caribbean', 'Teal'],
      light: ['Sky Blue', 'Pool', 'Aqua', 'Ice', 'Mist'],
    },
  },
  {
    family: 'Azure',
    range: [210, 240],
    names: {
      dark: ['Navy', 'Cobalt', 'Sapphire', 'Midnight', 'Indigo'],
      medium: ['Azure', 'Cerulean', 'Sky', 'Ocean', 'Pacific'],
      light: ['Powder Blue', 'Baby Blue', 'Periwinkle', 'Alice Blue', 'Ice'],
    },
  },
  {
    family: 'Indigo',
    range: [240, 275],
    names: {
      dark: ['Indigo', 'Sapphire', 'Midnight', 'Royal', 'Navy'],
      medium: ['Iris', 'Periwinkle', 'Cornflower', 'Blue Violet', 'Hyacinth'],
      light: ['Lavender', 'Lilac', 'Wisteria', 'Mauve', 'Thistle'],
    },
  },
  {
    family: 'Violet',
    range: [275, 305],
    names: {
      dark: ['Amethyst', 'Purple', 'Plum', 'Eggplant', 'Grape'],
      medium: ['Violet', 'Orchid', 'Purple', 'Iris', 'Heather'],
      light: ['Lilac', 'Lavender', 'Orchid', 'Mauve', 'Periwinkle'],
    },
  },
  {
    family: 'Magenta',
    range: [305, 345],
    names: {
      dark: ['Plum', 'Mulberry', 'Wine', 'Eggplant', 'Maroon'],
      medium: ['Fuchsia', 'Magenta', 'Hot Pink', 'Cerise', 'Orchid'],
      light: ['Pink', 'Rose', 'Peony', 'Carnation', 'Blush'],
    },
  },
];

function normalizeHue(h: number): number {
  let hue = h % 360;
  if (hue < 0) hue += 360;
  return hue;
}

function inHueRange(h: number, [start, end]: [number, number]): boolean {
  if (start <= end) {
    return h >= start && h < end;
  }
  return h >= start || h < end;
}

function getToneBucket(lightness: number, saturation: number): ToneBucket {
  // Adjust thresholds based on saturation
  // High saturation colors appear lighter, so use stricter thresholds
  const darknessThreshold = saturation > 60 ? 40 : 35;
  const lightnessThreshold = saturation > 60 ? 65 : 70;

  if (lightness <= darknessThreshold) return 'dark';
  if (lightness >= lightnessThreshold) return 'light';
  return 'medium';
}

function isNeutralColor(hsl: HSLValues): boolean {
  if (hsl.s <= NEUTRAL_THRESHOLD) return true;
  if (hsl.s <= 18 && (hsl.l <= 25 || hsl.l >= 85)) return true;
  return false;
}

function isEarthyTone(hsl: HSLValues): boolean {
  return hsl.s <= EARTH_SAT_THRESHOLD && hsl.s >= 10 && hsl.h >= 20 && hsl.h <= 70;
}

function getHuePalette(h: number): HuePalette {
  const hue = normalizeHue(h);
  return HUE_PALETTES.find((palette) => inHueRange(hue, palette.range)) ?? HUE_PALETTES[0];
}

/**
 * Get intensity descriptor based on saturation and lightness
 * More conservative - only add descriptors when truly needed
 */
function getIntensityDescriptor(
  saturation: number,
  lightness: number,
  tone: ToneBucket
): string | null {
  // Very low saturation - always describe neutrals
  if (saturation <= 15) {
    if (tone === 'light') return 'Soft';
    if (tone === 'dark') return 'Deep';
    return 'Muted';
  }

  // For low-medium saturation, skip descriptor (palette names are enough)
  if (saturation <= 30) {
    return null;
  }

  // High saturation - be selective
  if (saturation >= 75) {
    if (lightness >= 50 && lightness <= 75) {
      return 'Vivid'; // True vivid: high sat + medium-light
    } else if (lightness > 85) {
      return 'Bright'; // Very light + high sat
    } else if (lightness < 30) {
      return 'Deep'; // Dark + high sat
    }
    return null; // Skip for other cases
  }

  // Medium-high saturation (50-75)
  if (saturation >= 50) {
    if (tone === 'dark' && lightness < 30) return 'Rich';
    if (tone === 'light' && lightness > 80) return 'Luminous';
    return null; // Skip descriptor for medium tones
  }

  // Medium saturation (30-50) - mostly skip
  if (saturation >= 35) {
    if (tone === 'dark' && lightness < 25) return 'Dusky';
    return null;
  }

  return null;
}

/**
 * Smart name selection that avoids duplicates within a palette
 */
class PaletteNameTracker {
  private usedBaseNames = new Set<string>();
  private usedFullNames = new Set<string>();
  private descriptorCount: Record<string, number> = {};
  private hueFamilyCount: Record<string, number> = {};

  pickName(map: PaletteToneMap, tone: ToneBucket, seed: number, hueFamily: string): string {
    const options = map[tone] ?? map.medium;
    if (!options.length) return map.medium[0] ?? 'Color';

    // Track hue family usage
    const familyCount = this.hueFamilyCount[hueFamily] || 0;
    this.hueFamilyCount[hueFamily] = familyCount + 1;

    // If we've used this hue family multiple times, try harder to find unique names
    const startOffset = familyCount > 1 ? familyCount : 0;

    // Try to find an unused name
    for (let offset = startOffset; offset < options.length + startOffset; offset++) {
      const index = (Math.abs(seed) + offset) % options.length;
      const candidate = options[index];
      const candidateLower = candidate.toLowerCase();

      // Check if this exact name or a very similar variant is used
      let isTooSimilar = false;
      for (const used of this.usedBaseNames) {
        // Check for identical or substring matches
        if (
          used === candidateLower ||
          used.includes(candidateLower) ||
          candidateLower.includes(used)
        ) {
          isTooSimilar = true;
          break;
        }

        // Check for similar color family names (e.g., "Scarlet" vs "Vermilion")
        const words1 = used.split(/\s+/);
        const words2 = candidateLower.split(/\s+/);
        const commonWords = words1.filter((w) => words2.includes(w));
        if (commonWords.length > 0 && words1.length <= 2) {
          isTooSimilar = true;
          break;
        }
      }

      if (!isTooSimilar) {
        this.usedBaseNames.add(candidateLower);
        return candidate;
      }
    }

    // All names used - try with descriptors
    const base = options[Math.abs(seed) % options.length];
    const count = (this.descriptorCount[base] || 0) + 1;
    this.descriptorCount[base] = count;

    // Generate a unique variant
    const suffixes = ['Dark', 'Light', 'Deep', 'Soft', 'Muted', 'Bright', 'Rich'];
    for (const suffix of suffixes) {
      const variant = `${suffix} ${base}`;
      if (!this.usedFullNames.has(variant.toLowerCase())) {
        this.usedFullNames.add(variant.toLowerCase());
        return variant;
      }
    }

    // Last resort: numeric suffix
    return `${base} ${count + 1}`;
  }

  pickDescriptor(descriptor: string | null, baseName: string): string | null {
    if (!descriptor) return null;

    // Check if base name already has similar descriptors
    const lowerBase = baseName.toLowerCase();
    const lowerDesc = descriptor.toLowerCase();

    // Skip if base already contains the descriptor
    if (lowerBase.includes(lowerDesc)) return null;

    // Limit descriptor repetition
    const count = this.descriptorCount[descriptor] || 0;

    // If descriptor is used more than once, skip it
    if (count >= 1) return null;

    this.descriptorCount[descriptor] = count + 1;
    return descriptor;
  }

  markUsed(name: string): void {
    this.usedFullNames.add(name.toLowerCase());
  }
}

// Module-level tracker
let paletteTracker = new PaletteNameTracker();

/**
 * Reset the palette name tracker (called at the start of each extraction)
 */
export function resetPaletteNameTracker(): void {
  paletteTracker = new PaletteNameTracker();
}

/**
 * Check if a base name already contains intensity descriptors
 * that would conflict with the proposed descriptor
 */
function hasConflictingDescriptor(baseName: string, descriptor: string): boolean {
  const lowerBase = baseName.toLowerCase();
  const lowerDesc = descriptor.toLowerCase();

  // Direct inclusion
  if (lowerBase.includes(lowerDesc)) return true;

  // Conflicting intensity pairs
  const conflicts: Record<string, string[]> = {
    vivid: ['muted', 'dusky', 'soft', 'pale', 'deep'],
    muted: ['vivid', 'bright', 'luminous'],
    deep: ['bright', 'luminous', 'soft', 'pale'],
    bright: ['deep', 'dusky', 'muted'],
    luminous: ['deep', 'dusky', 'muted'],
    soft: ['vivid', 'deep'],
    pale: ['vivid', 'deep'],
  };

  // Check if base contains conflicting words
  const conflictWords = conflicts[lowerDesc] || [];
  for (const conflict of conflictWords) {
    if (lowerBase.includes(conflict)) return true;
  }

  // Check if base already has common descriptor words
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
      // Base already has descriptive quality, skip adding another
      return true;
    }
  }

  return false;
}

function finalizeName(base: string, descriptor: string | null): string {
  if (!descriptor) return base;

  // Check for conflicts or redundancy
  if (hasConflictingDescriptor(base, descriptor)) {
    return base; // Use base name as-is
  }

  return `${descriptor} ${base}`;
}

/**
 * Generate color name using improved heuristics + palette tracking
 */
export function generateColorName(rgb: RGBValues): string {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const tone = getToneBucket(hsl.l, hsl.s);
  const seed = Math.round(hsl.h * 17 + hsl.s * 13 + hsl.l * 11);

  if (isNeutralColor(hsl)) {
    const name = paletteTracker.pickName(NEUTRAL_NAMES, tone, seed, 'neutral');
    paletteTracker.markUsed(name);
    return name;
  }

  if (isEarthyTone(hsl)) {
    const name = paletteTracker.pickName(EARTH_TONES, tone, seed, 'earth');
    paletteTracker.markUsed(name);
    return name;
  }

  const palette = getHuePalette(hsl.h);
  const base = paletteTracker.pickName(palette.names, tone, seed, palette.family.toLowerCase());
  const rawDescriptor = getIntensityDescriptor(hsl.s, hsl.l, tone);
  const descriptor = paletteTracker.pickDescriptor(rawDescriptor, base);

  const finalName = finalizeName(base, descriptor);
  paletteTracker.markUsed(finalName);
  return finalName;
}
