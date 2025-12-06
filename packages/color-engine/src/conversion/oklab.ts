import type { RGBValues, HSLValues, OKLCHValues, OklabColor } from '@hue-und-you/types';
import { oklabCache, hslCache, oklchCache, LINEAR_LUT, rgbToKey, linearToSrgbFast } from './cache';

export function rgbToOklabCached(r: number, g: number, b: number): OklabColor {
  const key = rgbToKey(r, g, b);
  const cached = oklabCache.get(key);
  if (cached) return cached;

  const rl = LINEAR_LUT[Math.round(r)];
  const gl = LINEAR_LUT[Math.round(g)];
  const bl = LINEAR_LUT[Math.round(b)];

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const result: OklabColor = {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };

  oklabCache.set(key, result);
  return result;
}

export function rgbToHslCached(r: number, g: number, b: number): HSLValues {
  const key = rgbToKey(r, g, b);
  const cached = hslCache.get(key);
  if (cached) return cached;

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  const result: HSLValues = {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };

  hslCache.set(key, result);
  return result;
}

export function oklabToOklch(oklab: OklabColor): OKLCHValues {
  const { l, a, b } = oklab;
  const c = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return {
    l: Math.round(l * 10000) / 10000,
    c: Math.round(c * 10000) / 10000,
    h: Math.round(h * 100) / 100,
  };
}

export function oklchToRgbCached(oklch: OKLCHValues): RGBValues {
  const key = `${oklch.l.toFixed(3)}_${oklch.c.toFixed(3)}_${oklch.h.toFixed(1)}`;
  const cached = oklchCache.get(key);
  if (cached) return cached;

  const { l, c, h } = oklch;
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lms_l = l_ * l_ * l_;
  const lms_m = m_ * m_ * m_;
  const lms_s = s_ * s_ * s_;

  const rl = +4.0767416621 * lms_l - 3.3077115913 * lms_m + 0.2309699292 * lms_s;
  const gl = -1.2684380046 * lms_l + 2.6097574011 * lms_m - 0.3413193965 * lms_s;
  const bl = -0.0041960863 * lms_l - 0.7034186147 * lms_m + 1.707614701 * lms_s;

  const result: RGBValues = {
    r: Math.round(linearToSrgbFast(rl)),
    g: Math.round(linearToSrgbFast(gl)),
    b: Math.round(linearToSrgbFast(bl)),
  };

  oklchCache.set(key, result);
  return result;
}

export function rgbToHexFast(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function batchRgbToOklab(pixels: Array<{ r: number; g: number; b: number }>): OklabColor[] {
  return pixels.map((p) => rgbToOklabCached(p.r, p.g, p.b));
}

export function batchRgbToHsl(pixels: Array<{ r: number; g: number; b: number }>): HSLValues[] {
  return pixels.map((p) => rgbToHslCached(p.r, p.g, p.b));
}
