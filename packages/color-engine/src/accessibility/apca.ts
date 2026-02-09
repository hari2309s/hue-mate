import type { RGBValues } from '@hute-mate/types';

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function calculateAPCA(textRgb: RGBValues, bgRgb: RGBValues): number {
  const textY = relativeLuminance(textRgb.r, textRgb.g, textRgb.b);
  const bgY = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const contrast = Math.abs(textY - bgY);
  return Math.round(contrast * 100);
}
