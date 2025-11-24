import type { HSLValues, RGBValues } from '@hue-und-you/types';
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
// HEURISTIC COLOR NAMING
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
  dark: ['Obsidian Ash', 'Charcoal Drift', 'Inkstone Gray'],
  medium: ['Fogbound Slate', 'Dove Feather', 'Silver Haze'],
  light: ['Pearl Mist', 'Cloud Linen', 'Frosted Ivory'],
};

const EARTH_TONES: PaletteToneMap = {
  dark: ['Roasted Umber', 'Espresso Soil', 'Chestnut Bark'],
  medium: ['Copper Canyon', 'Amber Clay', 'Russet Trail'],
  light: ['Sandstone Glow', 'Golden Wheat', 'Honey Dust'],
};

const HUE_PALETTES: HuePalette[] = [
  {
    family: 'Crimson',
    range: [345, 20],
    names: {
      dark: ['Garnet Night', 'Merlot Ember', 'Bloodstone Red'],
      medium: ['Scarlet Bloom', 'Cherry Ember', 'Vermilion Pulse'],
      light: ['Rose Dawn', 'Coral Blush', 'Petal Flame'],
    },
  },
  {
    family: 'Copper',
    range: [20, 45],
    names: {
      dark: ['Molten Copper', 'Burnt Amber', 'Rust Ember'],
      medium: ['Copper Glow', 'Spiced Tangerine', 'Sunset Amber'],
      light: ['Apricot Halo', 'Golden Coral', 'Marmalade Light'],
    },
  },
  {
    family: 'Solar',
    range: [45, 75],
    names: {
      dark: ['Amber Honey', 'Goldenrod Ember', 'Ochre Horizon'],
      medium: ['Sunbeam Gold', 'Citrine Gleam', 'Marigold Burst'],
      light: ['Lemon Zest', 'Solar Glow', 'Champagne Dawn'],
    },
  },
  {
    family: 'Lime',
    range: [75, 110],
    names: {
      dark: ['Verdigris Moss', 'Forest Lime', 'Jade Canopy'],
      medium: ['Lime Grove', 'Spring Chartreuse', 'Citrus Leaf'],
      light: ['Lime Mist', 'Wasabi Bloom', 'Key Lime Veil'],
    },
  },
  {
    family: 'Verdant',
    range: [110, 150],
    names: {
      dark: ['Pine Shadow', 'Cedar Spruce', 'Moss Depths'],
      medium: ['Verdant Meadow', 'Fern Current', 'Garden Green'],
      light: ['Meadow Dew', 'Herb Tendril', 'Willow Veil'],
    },
  },
  {
    family: 'Emerald',
    range: [150, 185],
    names: {
      dark: ['Emerald Abyss', 'Jade Harbor', 'Deep Viridian'],
      medium: ['Emerald Current', 'Rainforest Teal', 'Lagoon Emerald'],
      light: ['Mint Foam', 'Seaglass Glow', 'Tidal Mint'],
    },
  },
  {
    family: 'Lagoon',
    range: [185, 210],
    names: {
      dark: ['Atlantic Teal', 'Storm Surf', 'Ocean Shadow'],
      medium: ['Lagoon Tide', 'Aqua Meridian', 'Sea Ridge'],
      light: ['Tropical Surf', 'Aqua Drift', 'Coastal Mist'],
    },
  },
  {
    family: 'Azure',
    range: [210, 240],
    names: {
      dark: ['Midnight Azure', 'Deep Cobalt', 'Indigo Surf'],
      medium: ['Azure Horizon', 'Cobalt Wave', 'Cerulean Crest'],
      light: ['Sky Arc', 'Glacial Azure', 'Icy Horizon'],
    },
  },
  {
    family: 'Indigo',
    range: [240, 275],
    names: {
      dark: ['Twilight Indigo', 'Sapphire Void', 'Orion Blue'],
      medium: ['Indigo Zephyr', 'Sapphire Aura', 'Blue Velvet'],
      light: ['Periwinkle Glow', 'Iris Haze', 'Lavender Mist'],
    },
  },
  {
    family: 'Violet',
    range: [275, 305],
    names: {
      dark: ['Royal Amethyst', 'Nightshade Violet', 'Mulberry Eclipse'],
      medium: ['Violet Bloom', 'Orchid Pulse', 'Amethyst Drift'],
      light: ['Lilac Veil', 'Lavender Drift', 'Wisteria Bloom'],
    },
  },
  {
    family: 'Magenta',
    range: [305, 345],
    names: {
      dark: ['Plum Eclipse', 'Berry Wine', 'Midnight Magenta'],
      medium: ['Fuchsia Blaze', 'Magenta Bloom', 'Hot Orchid'],
      light: ['Orchid Haze', 'Peony Glow', 'Neon Petal'],
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

function getToneBucket(lightness: number): ToneBucket {
  if (lightness <= 35) return 'dark';
  if (lightness >= 70) return 'light';
  return 'medium';
}

function pickFromToneMap(map: PaletteToneMap, tone: ToneBucket, seed: number): string {
  const options = map[tone] ?? map.medium;
  if (!options.length) {
    return map.medium[0] ?? 'Color';
  }
  const index = Math.abs(seed) % options.length;
  return options[index];
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

function getTextureDescriptor(saturation: number, tone: ToneBucket): string | null {
  if (saturation <= 18) {
    return tone === 'light' ? 'Soft' : 'Muted';
  }
  if (saturation >= 70) {
    return tone === 'light' ? 'Luminous' : 'Vivid';
  }
  if (tone === 'dark') {
    return 'Deep';
  }
  if (tone === 'light' && saturation <= 40) {
    return 'Airy';
  }
  return null;
}

function finalizeName(base: string, descriptor: string | null): string {
  if (!descriptor) return base;
  const lowerBase = base.toLowerCase();
  if (lowerBase.includes(descriptor.toLowerCase())) {
    return base;
  }
  return `${descriptor} ${base}`;
}

/**
 * Generate color name using heuristics + curated palette
 */
export function generateColorName(rgb: RGBValues): string {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const tone = getToneBucket(hsl.l);
  const seed = Math.round(hsl.h * 17 + hsl.s * 13 + hsl.l * 11);

  if (isNeutralColor(hsl)) {
    return pickFromToneMap(NEUTRAL_NAMES, tone, seed);
  }

  if (isEarthyTone(hsl)) {
    return pickFromToneMap(EARTH_TONES, tone, seed);
  }

  const palette = getHuePalette(hsl.h);
  const base = pickFromToneMap(palette.names, tone, seed);
  const descriptor = getTextureDescriptor(hsl.s, tone);
  return finalizeName(base, descriptor);
}
