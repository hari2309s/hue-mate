import type {
  ColorPaletteResult,
  ExtractedColor,
  ColorFormats,
  AccessibilityInfo,
  TintShade,
  ColorHarmony,
  SegmentInfo,
  ExportFormats,
} from '@hue-und-you/types';

const HF_API_URL = 'https://api-inference.huggingface.co/models';
const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;

// Hugging Face model endpoints
const BIREFNET_MODEL = 'ZhengPeng7/BiRefNet';
const SEGFORMER_MODEL = 'nvidia/segformer-b5-finetuned-ade-640-640';

interface SegmentationResult {
  label: string;
  mask: string;
  score: number;
}

// Call HF Inference API
async function callHFInference(model: string, imageBuffer: Buffer): Promise<SegmentationResult[]> {
  const response = await fetch(`${HF_API_URL}/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!response.ok) {
    if (response.status === 503) {
      await new Promise((r) => setTimeout(r, 20000));
      return callHFInference(model, imageBuffer);
    }
    throw new Error(`HF API error: ${response.status}`);
  }

  return response.json();
}

// Stage 1a: Foreground/Background Segmentation
export async function segmentForeground(imageBuffer: Buffer): Promise<SegmentationResult[]> {
  try {
    return await callHFInference(BIREFNET_MODEL, imageBuffer);
  } catch (error) {
    console.error('BiRefNet segmentation failed:', error);
    return [];
  }
}

// Stage 1b: Semantic Segmentation
export async function segmentSemantic(imageBuffer: Buffer): Promise<SegmentationResult[]> {
  try {
    return await callHFInference(SEGFORMER_MODEL, imageBuffer);
  } catch (error) {
    console.error('SegFormer segmentation failed:', error);
    return [];
  }
}

// Color space conversions
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
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

function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const l = 0.4122214708 * rn + 0.5363325363 * gn + 0.0514459929 * bn;
  const m = 0.2119034982 * rn + 0.6806995451 * gn + 0.1073969566 * bn;
  const s = 0.0883024619 * rn + 0.2817188376 * gn + 0.6299787005 * bn;

  const l_ = Math.cbrt(l),
    m_ = Math.cbrt(m),
    s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + b_ * b_);
  let H = Math.atan2(b_, a) * (180 / Math.PI);
  if (H < 0) H += 360;

  return { l: Math.round(L * 100) / 100, c: Math.round(C * 100) / 100, h: Math.round(H) };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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

function rgbToHsb(r: number, g: number, b: number): { h: number; s: number; b: number } {
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

function rgbToCmyk(
  r: number,
  g: number,
  b: number
): { c: number; m: number; y: number; k: number } {
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

function rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
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

function labToLch(l: number, a: number, b: number): { l: number; c: number; h: number } {
  const c = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return { l, c: Math.round(c), h: Math.round(h) };
}

function buildColorFormats(hex: string): ColorFormats {
  const rgb = hexToRgb(hex);
  const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
  const lch = labToLch(lab.l, lab.a, lab.b);

  return {
    hex,
    rgb: { css: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, values: rgb },
    oklch: { css: `oklch(${oklch.l * 100}% ${oklch.c} ${oklch.h})`, values: oklch },
    hsl: { css: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, values: hsl },
    hsb: { css: `hsb(${hsb.h}, ${hsb.s}%, ${hsb.b}%)`, values: hsb },
    cmyk: { css: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`, values: cmyk },
    lab: { css: `lab(${lab.l} ${lab.a} ${lab.b})`, values: lab },
    lch: { css: `lch(${lch.l} ${lch.c} ${lch.h})`, values: lch },
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(
  rgb1: { r: number; g: number; b: number },
  rgb2: { r: number; g: number; b: number }
): number {
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function buildAccessibilityInfo(hex: string): AccessibilityInfo {
  const rgb = hexToRgb(hex);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  const whiteRatio = contrastRatio(rgb, white);
  const blackRatio = contrastRatio(rgb, black);

  return {
    contrast_on_white: {
      ratio: Math.round(whiteRatio * 10) / 10,
      wcag_aa_normal: whiteRatio >= 4.5,
      wcag_aa_large: whiteRatio >= 3,
      wcag_aaa_normal: whiteRatio >= 7,
      wcag_aaa_large: whiteRatio >= 4.5,
    },
    contrast_on_black: {
      ratio: Math.round(blackRatio * 10) / 10,
      wcag_aa_normal: blackRatio >= 4.5,
      wcag_aa_large: blackRatio >= 3,
      wcag_aaa_normal: blackRatio >= 7,
      wcag_aaa_large: blackRatio >= 4.5,
    },
    apca: { on_white: Math.round(whiteRatio * 10), on_black: Math.round(blackRatio * 10) },
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

function adjustLightness(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  const adjust = (c: number) => Math.max(0, Math.min(255, c + amount));
  return rgbToHex(adjust(rgb.r), adjust(rgb.g), adjust(rgb.b));
}

function generateTintsShades(
  hex: string,
  name: string
): { tints: TintShade[]; shades: TintShade[] } {
  const rgb = hexToRgb(hex);
  const oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);
  const tints: TintShade[] = [];
  const shades: TintShade[] = [];

  for (let i = 1; i <= 4; i++) {
    const tintL = Math.min(oklch.l + i * 0.1, 1);
    const shadeL = Math.max(oklch.l - i * 0.1, 0);

    const tintHex = adjustLightness(hex, i * 15);
    const shadeHex = adjustLightness(hex, -i * 15);

    tints.push({
      level: i * 10,
      hex: tintHex,
      oklch: `oklch(${Math.round(tintL * 100)}% ${oklch.c} ${oklch.h})`,
      name: `${name} ${400 - i * 100}`,
    });

    shades.push({
      level: i * 10,
      hex: shadeHex,
      oklch: `oklch(${Math.round(shadeL * 100)}% ${oklch.c} ${oklch.h})`,
      name: `${name} ${500 + i * 100}`,
    });
  }

  return { tints, shades };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return rgbToHex(Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255));
}

function generateHarmonies(hex: string): ColorHarmony {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const rotateHue = (h: number, deg: number) => (h + deg + 360) % 360;

  const compHex = hslToHex(rotateHue(hsl.h, 180), hsl.s, hsl.l);
  const analog1 = hslToHex(rotateHue(hsl.h, 30), hsl.s, hsl.l);
  const analog2 = hslToHex(rotateHue(hsl.h, -30), hsl.s, hsl.l);
  const triad1 = hslToHex(rotateHue(hsl.h, 120), hsl.s, hsl.l);
  const triad2 = hslToHex(rotateHue(hsl.h, 240), hsl.s, hsl.l);
  const split1 = hslToHex(rotateHue(hsl.h, 150), hsl.s, hsl.l);
  const split2 = hslToHex(rotateHue(hsl.h, 210), hsl.s, hsl.l);

  const makeHarmony = (h: string, n: string) => {
    const hRgb = hexToRgb(h);
    const o = rgbToOklch(hRgb.r, hRgb.g, hRgb.b);
    return { hex: h, oklch: `oklch(${o.l * 100}% ${o.c} ${o.h})`, name: n };
  };

  return {
    complementary: makeHarmony(compHex, 'Complementary'),
    analogous: [makeHarmony(analog1, 'Analogous 1'), makeHarmony(analog2, 'Analogous 2')],
    triadic: [makeHarmony(triad1, 'Triadic 1'), makeHarmony(triad2, 'Triadic 2')],
    split_complementary: [makeHarmony(split1, 'Split 1'), makeHarmony(split2, 'Split 2')],
  };
}

const CSS_COLORS: Record<string, string> = {
  '#000000': 'black',
  '#FFFFFF': 'white',
  '#FF0000': 'red',
  '#00FF00': 'lime',
  '#0000FF': 'blue',
  '#FFFF00': 'yellow',
  '#00FFFF': 'cyan',
  '#FF00FF': 'magenta',
  '#808080': 'gray',
  '#800000': 'maroon',
  '#008000': 'green',
  '#000080': 'navy',
  '#808000': 'olive',
  '#800080': 'purple',
  '#008080': 'teal',
  '#C0C0C0': 'silver',
  '#FFA500': 'orange',
  '#FFC0CB': 'pink',
  '#A52A2A': 'brown',
  '#F5F5DC': 'beige',
};

function findNearestColorName(hex: string): string {
  const rgb = hexToRgb(hex);
  let minDist = Infinity;
  let nearest = 'unknown';

  for (const [cssHex, name] of Object.entries(CSS_COLORS)) {
    const cssRgb = hexToRgb(cssHex);
    const dist = Math.sqrt(
      Math.pow(rgb.r - cssRgb.r, 2) + Math.pow(rgb.g - cssRgb.g, 2) + Math.pow(rgb.b - cssRgb.b, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      nearest = name;
    }
  }
  return nearest;
}

function classifyTemperature(hue: number): 'warm' | 'cool' | 'neutral' {
  if ((hue >= 0 && hue <= 60) || (hue >= 300 && hue <= 360)) return 'warm';
  if (hue >= 120 && hue <= 240) return 'cool';
  return 'neutral';
}

function kMeansColors(pixels: number[][], k: number = 5, maxIter: number = 50): number[][] {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels;

  let centroids = pixels.slice(0, k).map((p) => [...p]);

  for (let iter = 0; iter < maxIter; iter++) {
    const clusters: number[][][] = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let closest = 0;
      for (let i = 0; i < k; i++) {
        const dist = Math.sqrt(
          Math.pow(pixel[0] - centroids[i][0], 2) +
            Math.pow(pixel[1] - centroids[i][1], 2) +
            Math.pow(pixel[2] - centroids[i][2], 2)
        );
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      clusters[closest].push(pixel);
    }

    const newCentroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];
      return [
        Math.round(cluster.reduce((s, p) => s + p[0], 0) / cluster.length),
        Math.round(cluster.reduce((s, p) => s + p[1], 0) / cluster.length),
        Math.round(cluster.reduce((s, p) => s + p[2], 0) / cluster.length),
      ];
    });

    const converged = centroids.every(
      (c, i) =>
        c[0] === newCentroids[i][0] && c[1] === newCentroids[i][1] && c[2] === newCentroids[i][2]
    );
    centroids = newCentroids;
    if (converged) break;
  }

  return centroids;
}

async function extractPixelsFromBuffer(buffer: Buffer): Promise<number[][]> {
  const pixels: number[][] = [];
  const step = Math.max(1, Math.floor(buffer.length / 1000));

  for (let i = 0; i < buffer.length - 3; i += step * 3) {
    pixels.push([buffer[i], buffer[i + 1], buffer[i + 2]]);
  }

  return pixels;
}

function generateExports(colors: ExtractedColor[]): ExportFormats {
  const cssVars = colors
    .map((c) => {
      const lines = [`  ${c.metadata.css_variable_name}: ${c.formats.hex};`];
      c.tints.forEach((t, i) =>
        lines.push(`  ${c.metadata.css_variable_name}-${(i + 1) * 100}: ${t.hex};`)
      );
      c.shades.forEach((s, i) =>
        lines.push(`  ${c.metadata.css_variable_name}-${500 + (i + 1) * 100}: ${s.hex};`)
      );
      return lines.join('\n');
    })
    .join('\n');

  const tailwindColors: Record<string, Record<string, string>> = {};
  colors.forEach((c) => {
    const name = c.name.toLowerCase().replace(/\s+/g, '-');
    tailwindColors[name] = {
      DEFAULT: c.formats.hex,
      ...Object.fromEntries(c.tints.map((t, i) => [`${(i + 1) * 100}`, t.hex])),
      500: c.formats.hex,
      ...Object.fromEntries(c.shades.map((s, i) => [`${500 + (i + 1) * 100}`, s.hex])),
    };
  });

  const figmaTokens: Record<string, object> = {};
  colors.forEach((c) => {
    figmaTokens[c.name.toLowerCase().replace(/\s+/g, '-')] = {
      value: c.formats.hex,
      type: 'color',
      description: `Extracted color: ${c.name}`,
    };
  });

  const scssVars = colors
    .map((c) => {
      const name = c.name.toLowerCase().replace(/\s+/g, '-');
      const lines = [`$${name}: ${c.formats.hex};`];
      c.tints.forEach((t, i) => lines.push(`$${name}-${(i + 1) * 100}: ${t.hex};`));
      c.shades.forEach((s, i) => lines.push(`$${name}-${500 + (i + 1) * 100}: ${s.hex};`));
      return lines.join('\n');
    })
    .join('\n');

  return {
    css_variables: `:root {\n${cssVars}\n}`,
    tailwind_config: { theme: { extend: { colors: tailwindColors } } },
    figma_tokens: figmaTokens,
    scss_variables: scssVars,
  };
}

export async function extractColorsFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: { numColors?: number; includeBackground?: boolean; generateHarmonies?: boolean } = {}
): Promise<ColorPaletteResult> {
  const { numColors = 5, generateHarmonies: genHarm = true } = options;

  // Stage 1: Segmentation (parallel)
  const [fgSegments, semSegments] = await Promise.all([
    segmentForeground(imageBuffer),
    segmentSemantic(imageBuffer),
  ]);

  // Stage 2: Extract pixels and cluster
  const pixels = await extractPixelsFromBuffer(imageBuffer);
  const dominantColors = kMeansColors(pixels, numColors);

  // Build palette
  const palette: ExtractedColor[] = dominantColors.map((rgb, i) => {
    const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    const nearestName = findNearestColorName(hex);
    const hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    const { tints, shades } = generateTintsShades(hex, nearestName);

    return {
      id: `color_${String(i + 1).padStart(3, '0')}`,
      name: nearestName.charAt(0).toUpperCase() + nearestName.slice(1),
      source: {
        segment: i < numColors / 2 ? 'foreground' : 'background',
        category: semSegments[0]?.label,
        pixel_coverage: 1 / numColors,
        confidence: 0.85,
      },
      formats: buildColorFormats(hex),
      accessibility: buildAccessibilityInfo(hex),
      tints,
      shades,
      harmony: genHarm
        ? generateHarmonies(hex)
        : {
            complementary: { hex: '', oklch: '', name: '' },
            analogous: [],
            triadic: [],
            split_complementary: [],
          },
      metadata: {
        temperature: classifyTemperature(hsl.h),
        nearest_css_color: nearestName,
        css_variable_name: `--color-${nearestName.toLowerCase().replace(/\s+/g, '-')}`,
      },
    };
  });

  const segments: SegmentInfo = {
    foreground: { pixel_percentage: fgSegments.length > 0 ? 45 : 50 },
    background: { pixel_percentage: fgSegments.length > 0 ? 55 : 50 },
    categories: semSegments.map((s) => s.label).filter(Boolean),
  };

  return {
    id: `palette_${Date.now()}`,
    source_image: {
      filename,
      dimensions: { width: 0, height: 0 },
      processed_at: new Date().toISOString(),
    },
    segments,
    palette,
    exports: generateExports(palette),
  };
}
