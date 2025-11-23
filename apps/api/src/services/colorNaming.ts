import type { RGBValues } from '@hue-und-you/types';

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
