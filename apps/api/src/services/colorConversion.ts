import type {
  RGBValues,
  OKLCHValues,
  HSLValues,
  HSBValues,
  CMYKValues,
  LABValues,
  LCHValues,
  ColorFormats,
} from '@hue-und-you/types';
import type { OklabColor } from '../types/segmentation';

// ============================================
// RGB <-> OKLAB <-> OKLCH
// ============================================

export function rgbToOklab(r: number, g: number, b: number): OklabColor {
  const linearize = (c: number) => {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const rl = linearize(r);
  const gl = linearize(g);
  const bl = linearize(b);

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
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

export function oklchToRgb(oklch: OKLCHValues): RGBValues {
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

  const srgb = (c: number) => {
    c = Math.max(0, Math.min(1, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  return {
    r: Math.round(srgb(rl) * 255),
    g: Math.round(srgb(gl) * 255),
    b: Math.round(srgb(bl) * 255),
  };
}

// ============================================
// RGB -> Other Formats
// ============================================

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) =>
        Math.max(0, Math.min(255, Math.round(x)))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
      .toUpperCase()
  );
}

export function rgbToHsl(r: number, g: number, b: number): HSLValues {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function rgbToHsb(r: number, g: number, b: number): HSBValues {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0;
  const v = max,
    d = max - min;
  const s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), b: Math.round(v * 100) };
}

export function rgbToCmyk(r: number, g: number, b: number): CMYKValues {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - rn - k) / (1 - k)) * 100),
    m: Math.round(((1 - gn - k) / (1 - k)) * 100),
    y: Math.round(((1 - bn - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

export function rgbToLab(r: number, g: number, b: number): LABValues {
  let rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  rn = rn > 0.04045 ? Math.pow((rn + 0.055) / 1.055, 2.4) : rn / 12.92;
  gn = gn > 0.04045 ? Math.pow((gn + 0.055) / 1.055, 2.4) : gn / 12.92;
  bn = bn > 0.04045 ? Math.pow((bn + 0.055) / 1.055, 2.4) : bn / 12.92;

  let x = (rn * 0.4124 + gn * 0.3576 + bn * 0.1805) / 0.95047;
  let y = (rn * 0.2126 + gn * 0.7152 + bn * 0.0722) / 1.0;
  let z = (rn * 0.0193 + gn * 0.1192 + bn * 0.9505) / 1.08883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  return {
    l: Math.round(116 * y - 16),
    a: Math.round(500 * (x - y)),
    b: Math.round(200 * (y - z)),
  };
}

export function labToLch(l: number, a: number, b: number): LCHValues {
  const c = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return { l, c: Math.round(c), h: Math.round(h) };
}

// ============================================
// Build All Color Formats
// ============================================

export function buildColorFormats(rgb: RGBValues): ColorFormats {
  const { r, g, b } = rgb;
  const hex = rgbToHex(r, g, b);
  const oklab = rgbToOklab(r, g, b);
  const oklch = oklabToOklch(oklab);
  const hsl = rgbToHsl(r, g, b);
  const hsb = rgbToHsb(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);
  const lab = rgbToLab(r, g, b);
  const lch = labToLch(lab.l, lab.a, lab.b);

  return {
    hex,
    rgb: { css: `rgb(${r}, ${g}, ${b})`, values: rgb },
    oklch: {
      css: `oklch(${(oklch.l * 100).toFixed(2)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`,
      values: oklch,
    },
    hsl: { css: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, values: hsl },
    hsb: { css: `hsb(${hsb.h}, ${hsb.s}%, ${hsb.b}%)`, values: hsb },
    cmyk: { css: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`, values: cmyk },
    lab: { css: `lab(${lab.l} ${lab.a} ${lab.b})`, values: lab },
    lch: { css: `lch(${lch.l} ${lch.c} ${lch.h})`, values: lch },
  };
}
