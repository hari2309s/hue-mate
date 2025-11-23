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
// CATEGORY PREFIXES (Only use for distinctive categories)
// ============================================

const CATEGORY_PREFIXES: Record<string, string> = {
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
  snow: 'Frost',
  mountain: 'Alpine',
  // Removed wall, building, etc. - too generic
};

// Categories where color is highly predictive
const COLOR_PREDICTIVE_CATEGORIES = new Set([
  'sky',
  'water',
  'sea',
  'river',
  'lake',
  'grass',
  'tree',
  'plant',
  'snow',
  'sand',
  'mountain',
]);

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
// CHECK IF COLOR MATCHES CATEGORY EXPECTATION (STRICTER)
// ============================================

export function doesColorMatchCategory(rgb: RGBValues, category: string): boolean {
  const { r, g, b } = rgb;
  const normalizedCategory = category.toLowerCase();

  const brightness = (r + g + b) / 3;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;

  switch (normalizedCategory) {
    case 'sky':
      // Sky: blue (day) OR very dark (night) OR very light (overcast)
      return (
        (b > r * 1.1 && b > g * 0.9) || // Blue sky
        brightness > 180 || // Bright/white sky
        (brightness < 50 && saturation < 0.4) // Night sky
      );

    case 'water':
    case 'sea':
    case 'river':
    case 'lake':
      // Water: blue/cyan/teal or dark reflective
      return (
        b > r || // Blue water
        (g > r && b > r * 0.8) || // Cyan/teal water
        (brightness < 100 && saturation < 0.3) // Dark reflective water
      );

    case 'grass':
    case 'plant':
      // Green vegetation (must be green)
      return g >= r * 1.1 && g >= b * 1.1;

    case 'tree':
    case 'forest':
      // Green OR brown
      return (
        (g >= r * 1.05 && g >= b * 1.05) || // Slightly more lenient green
        (r > g * 0.8 && g > b * 1.1 && r < 200 && saturation > 0.1) // Brown
      );

    case 'sand':
    case 'earth':
      // Warm tan/brown, moderate saturation
      return r >= g * 0.8 && g >= b * 0.9 && saturation < 0.5 && brightness > 100;

    case 'snow':
    case 'frost':
      // Very light, desaturated
      return brightness > 180 && saturation < 0.2;

    case 'mountain':
    case 'alpine':
      // Gray/brown tones, moderate brightness
      return saturation < 0.4 && brightness > 60 && brightness < 180;

    default:
      // Unknown categories don't get prefixes
      return false;
  }
}

// ============================================
// GET BEST CATEGORY FOR COLOR (COLOR + SEGMENT AWARE)
// ============================================

export function getBestCategoryForColor(
  rgb: RGBValues,
  categories: CategoryWithScore[],
  _segment: 'foreground' | 'background'
): string | undefined {
  const relevant = filterRelevantCategories(categories, MIN_CATEGORY_COVERAGE);

  if (relevant.length === 0) {
    return undefined;
  }

  // Filter to categories where the color actually matches expectations
  const matchingCategories = relevant.filter((cat) => doesColorMatchCategory(rgb, cat.label));

  if (matchingCategories.length === 0) {
    return undefined;
  }

  // Prioritize color-predictive categories (sky, water, grass, etc)
  const colorPredictive = matchingCategories.find((cat) =>
    COLOR_PREDICTIVE_CATEGORIES.has(cat.label.toLowerCase())
  );

  if (colorPredictive) {
    return colorPredictive.label;
  }

  // Otherwise return highest scoring matching category
  return matchingCategories[0].label;
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
// ENHANCED COLOR NAMING WITH BETTER CATEGORY LOGIC
// ============================================

export function getEnhancedColorName(
  rgb: RGBValues,
  categories: CategoryWithScore[],
  segment: 'foreground' | 'background'
): string {
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

  // Try to get best matching category for this specific color
  const category = getBestCategoryForColor(rgb, categories, segment);

  // Only add prefix if we have a valid category match
  if (category && CATEGORY_PREFIXES[category.toLowerCase()]) {
    return `${CATEGORY_PREFIXES[category.toLowerCase()]} ${cleanName}`;
  }

  return cleanName;
}

// ============================================
// GENERATE CSS VARIABLE NAME
// ============================================

export function generateCssVariableName(colorName: string): string {
  return `--color-${colorName.toLowerCase().replace(/\s+/g, '-')}`;
}

// ============================================
// LEGACY EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================

// These are kept for any code that might still use them
export function getBestCategoryForSegment(
  categories: CategoryWithScore[],
  _segment: 'foreground' | 'background'
): string {
  const relevant = filterRelevantCategories(categories);
  if (relevant.length === 0) return 'unknown';
  return relevant[0].label;
}
