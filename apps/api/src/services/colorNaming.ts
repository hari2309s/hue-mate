import namer from 'color-namer';
import type { RGBValues } from '@hue-und-you/types';
import { rgbToHex } from './colorConversion';

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
// CATEGORY PREFIXES FOR CONTEXTUAL NAMING
// ============================================

const CATEGORY_PREFIXES: Record<string, string> = {
  // Natural elements
  sky: 'Sky',
  sea: 'Ocean',
  water: 'Water',
  river: 'River',
  lake: 'Lake',
  plant: 'Leaf',
  tree: 'Forest',
  grass: 'Meadow',
  flower: 'Floral',
  sand: 'Sand',
  earth: 'Earth',
  rock: 'Stone',
  mountain: 'Alpine',
  snow: 'Frost',
  cloud: 'Cloud',
  // Built environment
  building: 'Urban',
  wall: 'Wall',
  floor: 'Floor',
  ceiling: 'Ceiling',
  road: 'Asphalt',
  sidewalk: 'Pavement',
  fence: 'Fence',
  // Objects
  furniture: 'Interior',
  curtain: 'Fabric',
  carpet: 'Textile',
  wood: 'Wood',
  metal: 'Metal',
  glass: 'Glass',
  // People/clothing
  person: 'Portrait',
  clothing: 'Fabric',
};

// Minimum coverage threshold for a category to be used in naming (percentage)
const MIN_CATEGORY_COVERAGE = 5;

// ============================================
// CATEGORY WITH SCORE TYPE
// ============================================

export interface CategoryWithScore {
  label: string;
  score: number;
}

// ============================================
// FILTER RELEVANT CATEGORIES
// ============================================

export function filterRelevantCategories(
  categories: CategoryWithScore[],
  minCoverage: number = MIN_CATEGORY_COVERAGE
): CategoryWithScore[] {
  return categories
    .filter((cat) => cat.score * 100 >= minCoverage)
    .sort((a, b) => b.score - a.score);
}

// ============================================
// GET BEST CATEGORY FOR SEGMENT
// ============================================

export function getBestCategoryForSegment(
  categories: CategoryWithScore[],
  segment: 'foreground' | 'background'
): string {
  const relevant = filterRelevantCategories(categories);

  if (relevant.length === 0) {
    return 'unknown';
  }

  // Background-preferred categories (typically large scene elements)
  const backgroundPreferred = new Set([
    'sky',
    'wall',
    'floor',
    'ceiling',
    'road',
    'grass',
    'water',
    'sea',
    'mountain',
    'building',
    'tree',
    'earth',
    'sand',
    'snow',
    'cloud',
  ]);

  // Foreground-preferred categories (typically objects/subjects)
  const foregroundPreferred = new Set([
    'person',
    'flower',
    'plant',
    'furniture',
    'car',
    'animal',
    'food',
    'clothing',
  ]);

  if (segment === 'background') {
    const bgCategory = relevant.find((cat) => backgroundPreferred.has(cat.label.toLowerCase()));
    if (bgCategory) {
      return bgCategory.label;
    }
  } else if (segment === 'foreground') {
    const fgCategory = relevant.find((cat) => foregroundPreferred.has(cat.label.toLowerCase()));
    if (fgCategory) {
      return fgCategory.label;
    }
  }

  // Default to highest scoring
  return relevant[0].label;
}

// ============================================
// CHECK IF COLOR MATCHES CATEGORY EXPECTATION
// ============================================

export function doesColorMatchCategory(rgb: RGBValues, category: string): boolean {
  const { r, g, b } = rgb;
  const normalizedCategory = category.toLowerCase();

  // Calculate basic color properties
  const brightness = (r + g + b) / 3;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;

  // Check if color roughly matches expected category colors
  switch (normalizedCategory) {
    case 'sky':
      // Sky should be bluish or light (overcast)
      return (b > r && b > g * 0.8) || brightness > 180;
    case 'water':
    case 'sea':
    case 'river':
    case 'lake':
      // Water should be bluish or cyan-ish
      return b > r || (g > r && b > r * 0.8);
    case 'grass':
    case 'tree':
    case 'plant':
    case 'forest':
      // Vegetation should be greenish or brownish (autumn)
      return (g >= r * 0.7 && g >= b * 0.7) || (r > g && g > b); // green or brown
    case 'sand':
    case 'earth':
      // Should be warm/tan colors
      return r >= g * 0.8 && g >= b && saturation < 0.7;
    case 'snow':
    case 'cloud':
      // Should be very light
      return brightness > 180;
    case 'wall':
    case 'building':
    case 'floor':
    case 'ceiling':
    case 'road':
      // Built environment can be any color, but typically neutral
      return true;
    case 'person':
    case 'clothing':
      // People/clothing can be any color
      return true;
    default:
      // For other categories, allow any color
      return true;
  }
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
// ENHANCED COLOR NAMING WITH CONTEXT
// ============================================

export function getEnhancedColorName(rgb: RGBValues, category?: string): string {
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

  // Use color-namer for rich naming
  const names = namer(hex);

  // Prioritize NTC names (most descriptive), fallback to basic
  const ntcName = names.ntc[0]?.name || '';
  const basicName = names.basic[0]?.name || '';
  const bestName = ntcName || basicName || 'Unknown';

  // Clean up the name (capitalize properly)
  const cleanName = bestName
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Add category prefix for specific, meaningful categories
  if (category && category !== 'unknown') {
    const normalizedCategory = category.toLowerCase();
    const prefix = CATEGORY_PREFIXES[normalizedCategory];
    if (prefix) {
      return `${prefix} ${cleanName}`;
    }
  }

  return cleanName;
}

// ============================================
// GENERATE CSS VARIABLE NAME
// ============================================

export function generateCssVariableName(colorName: string): string {
  return `--color-${colorName.toLowerCase().replace(/\s+/g, '-')}`;
}
