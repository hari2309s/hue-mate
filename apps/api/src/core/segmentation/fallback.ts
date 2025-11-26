import type { PixelData } from '../../types/segmentation';

export function splitPixelsByLuminance(
  pixels: PixelData[],
  splitRatio: number = 0.3
): {
  foreground: PixelData[];
  background: PixelData[];
} {
  const pixelsWithScore = pixels.map((p) => {
    const max = Math.max(p.r, p.g, p.b);
    const min = Math.min(p.r, p.g, p.b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;

    return {
      ...p,
      sat,
      lum,
      score: sat * 0.7 + (Math.abs(lum - 128) / 255) * 0.3,
    };
  });

  pixelsWithScore.sort((a, b) => b.score - a.score);

  const splitPoint = Math.floor(pixels.length * splitRatio);

  return {
    foreground: pixelsWithScore.slice(0, splitPoint).map(({ r, g, b }) => ({ r, g, b })),
    background: pixelsWithScore.slice(splitPoint).map(({ r, g, b }) => ({ r, g, b })),
  };
}
