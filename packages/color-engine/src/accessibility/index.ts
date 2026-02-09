import type { RGBValues, AccessibilityInfo } from '@hute-mate/types';
import { contrastRatio, buildContrastResult } from './contrast';
import { calculateAPCA } from './apca';

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

export { contrastRatio, buildContrastResult } from './contrast';
export { calculateAPCA } from './apca';
