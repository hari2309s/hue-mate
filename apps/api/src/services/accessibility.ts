import type { RGBValues, AccessibilityInfo, ContrastResult } from '@hue-und-you/types';

// ============================================
// RELATIVE LUMINANCE (WCAG)
// ============================================

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// ============================================
// WCAG CONTRAST RATIO
// ============================================

function contrastRatio(rgb1: RGBValues, rgb2: RGBValues): number {
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================
// APCA CONTRAST (Accessible Perceptual Contrast Algorithm)
// ============================================

function calculateAPCA(textRgb: RGBValues, bgRgb: RGBValues): number {
  const textY = relativeLuminance(textRgb.r, textRgb.g, textRgb.b);
  const bgY = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const contrast = Math.abs(textY - bgY);
  return Math.round(contrast * 100);
}

// ============================================
// BUILD CONTRAST RESULT
// ============================================

function buildContrastResult(ratio: number): ContrastResult {
  return {
    ratio: Math.round(ratio * 10) / 10,
    wcag_aa_normal: ratio >= 4.5,
    wcag_aa_large: ratio >= 3,
    wcag_aaa_normal: ratio >= 7,
    wcag_aaa_large: ratio >= 4.5,
  };
}

// ============================================
// BUILD FULL ACCESSIBILITY INFO
// ============================================

export function buildAccessibilityInfo(rgb: RGBValues): AccessibilityInfo {
  const white: RGBValues = { r: 255, g: 255, b: 255 };
  const black: RGBValues = { r: 0, g: 0, b: 0 };

  const whiteRatio = contrastRatio(rgb, white);
  const blackRatio = contrastRatio(rgb, black);

  return {
    contrast_on_white: buildContrastResult(whiteRatio),
    contrast_on_black: buildContrastResult(blackRatio),
    apca: {
      on_white: calculateAPCA(rgb, white),
      on_black: calculateAPCA(rgb, black),
    },
    suggested_text_color:
      whiteRatio > blackRatio
        ? {
            hex: '#FFFFFF',
            reason: `Higher contrast (${whiteRatio.toFixed(1)} vs ${blackRatio.toFixed(1)})`,
          }
        : {
            hex: '#000000',
            reason: `Higher contrast (${blackRatio.toFixed(1)} vs ${whiteRatio.toFixed(1)})`,
          },
  };
}
