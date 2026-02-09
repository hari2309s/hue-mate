import { LRUCache } from '@hute-mate/utils';
import type { RGBValues, HSLValues, OklabColor } from '@hute-mate/types';

// Cache instances
export const oklabCache = new LRUCache<number, OklabColor>(2000);
export const hslCache = new LRUCache<number, HSLValues>(2000);
export const oklchCache = new LRUCache<string, RGBValues>(1000);

// Lookup tables for performance
export const LINEAR_LUT = new Float32Array(256);
export const SRGB_LUT = new Float32Array(2048);

// Initialize lookup tables
(function initLookupTables() {
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    LINEAR_LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  for (let i = 0; i < 2048; i++) {
    const c = i / 2047;
    SRGB_LUT[i] = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }
})();

export function rgbToKey(r: number, g: number, b: number): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function linearToSrgbFast(linear: number): number {
  const clamped = Math.max(0, Math.min(1, linear));
  const index = clamped * 2047;
  const i0 = Math.floor(index);
  const i1 = Math.min(i0 + 1, 2047);
  const frac = index - i0;
  return (SRGB_LUT[i0] * (1 - frac) + SRGB_LUT[i1] * frac) * 255;
}

export function clearConversionCaches(): void {
  oklabCache.clear();
  hslCache.clear();
  oklchCache.clear();
}

export function getConversionCacheStats() {
  return {
    oklab: { size: oklabCache.size(), maxSize: 2000 },
    hsl: { size: hslCache.size(), maxSize: 2000 },
    oklch: { size: oklchCache.size(), maxSize: 1000 },
  };
}
