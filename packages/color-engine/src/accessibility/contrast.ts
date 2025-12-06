import type { RGBValues, ContrastResult } from '@hue-und-you/types';

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function contrastRatio(rgb1: RGBValues, rgb2: RGBValues): number {
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function buildContrastResult(ratio: number): ContrastResult {
  return {
    ratio: Math.round(ratio * 10) / 10,
    wcag_aa_normal: ratio >= 4.5,
    wcag_aa_large: ratio >= 3,
    wcag_aaa_normal: ratio >= 7,
    wcag_aaa_large: ratio >= 4.5,
  };
}
