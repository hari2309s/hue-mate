import type {
  ColorPaletteResult,
  ExtractedColor,
  ColorFormats,
  AccessibilityInfo,
  TintShade,
  ColorHarmony,
  SegmentInfo,
  ExportFormats,
  RGBValues,
  OKLCHValues,
  HSLValues,
} from '@hue-und-you/types';

const HF_API_URL = 'https://api-inference.huggingface.co/models';
const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;

// ============================================
// STAGE 1b: SEMANTIC SEGMENTATION
// Using nvidia/segformer-b0-finetuned-ade-512-512 (Available on Inference API)
// ============================================

const SEGFORMER_MODEL = 'nvidia/segformer-b0-finetuned-ade-512-512';

interface SegmentationMask {
  label: string;
  mask: string; // Base64 encoded mask
  score: number;
}

async function callSegFormer(imageBuffer: Buffer): Promise<SegmentationMask[]> {
  try {
    const response = await fetch(`${HF_API_URL}/${SEGFORMER_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: imageBuffer.toString('base64'),
      }),
    });

    if (!response.ok) {
      if (response.status === 503) {
        console.log('Model loading, waiting 20 seconds...');
        await new Promise((r) => setTimeout(r, 20000));
        return callSegFormer(imageBuffer);
      }
      throw new Error(`HF API error: ${response.status}`);
    }

    return response.json() as unknown as SegmentationMask[];
  } catch (error) {
    console.error('SegFormer segmentation failed:', error);
    return [];
  }
}

// ============================================
// STAGE 2: COLOR EXTRACTION & QUANTIZATION
// Using OKLCH color space for perceptual uniformity
// ============================================

// Convert RGB to OKLAB (perceptually uniform color space)
function rgbToOklab(r: number, g: number, b: number): { l: number; a: number; b: number } {
  // Linearize sRGB
  const linearize = (c: number) => {
    c = c / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const rl = linearize(r);
  const gl = linearize(g);
  const bl = linearize(b);

  // Convert to LMS cone response
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  // Apply cube root
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // Convert to Oklab
  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

// Convert OKLAB to OKLCH (cylindrical representation)
function oklabToOklch(oklab: { l: number; a: number; b: number }): OKLCHValues {
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

// Convert OKLCH back to RGB
function oklchToRgb(oklch: OKLCHValues): RGBValues {
  const { l, c, h } = oklch;

  // Convert to Oklab
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  // Convert to LMS
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lms_l = l_ * l_ * l_;
  const lms_m = m_ * m_ * m_;
  const lms_s = s_ * s_ * s_;

  // Convert to linear RGB
  const rl = +4.0767416621 * lms_l - 3.3077115913 * lms_m + 0.2309699292 * lms_s;
  const gl = -1.2684380046 * lms_l + 2.6097574011 * lms_m - 0.3413193965 * lms_s;
  const bl = -0.0041960863 * lms_l - 0.7034186147 * lms_m + 1.707614701 * lms_s;

  // Gamma correction to sRGB
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

// K-means++ initialization for better clustering
function kMeansPlusPlus(
  pixels: Array<{ r: number; g: number; b: number; oklab: { l: number; a: number; b: number } }>,
  k: number
): Array<{ r: number; g: number; b: number; oklab: { l: number; a: number; b: number } }> {
  const centroids: Array<{
    r: number;
    g: number;
    b: number;
    oklab: { l: number; a: number; b: number };
  }> = [];

  // First centroid: random
  centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });

  // Remaining centroids: weighted by distance
  for (let i = 1; i < k; i++) {
    const distances = pixels.map((pixel) => {
      const minDist = Math.min(
        ...centroids.map((c) => {
          const dl = pixel.oklab.l - c.oklab.l;
          const da = pixel.oklab.a - c.oklab.a;
          const db = pixel.oklab.b - c.oklab.b;
          return Math.sqrt(dl * dl + da * da + db * db);
        })
      );
      return minDist * minDist;
    });

    const totalDist = distances.reduce((sum, d) => sum + d, 0);
    let threshold = Math.random() * totalDist;

    for (let j = 0; j < pixels.length; j++) {
      threshold -= distances[j];
      if (threshold <= 0) {
        centroids.push({ ...pixels[j] });
        break;
      }
    }
  }

  return centroids;
}

// K-means clustering in OKLAB space (perceptually uniform)
function kMeansClusteringOklab(
  pixels: Array<{ r: number; g: number; b: number }>,
  k: number,
  maxIterations: number = 100
): Array<{ r: number; g: number; b: number; weight: number }> {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels.map((p) => ({ ...p, weight: 1 / pixels.length }));

  // Convert all pixels to OKLAB
  const oklabPixels = pixels.map((p) => ({
    ...p,
    oklab: rgbToOklab(p.r, p.g, p.b),
  }));

  // Initialize with k-means++
  let centroids = kMeansPlusPlus(oklabPixels, k);
  let converged = false;
  let iteration = 0;

  while (!converged && iteration < maxIterations) {
    iteration++;

    // Assign pixels to nearest centroid (in OKLAB space)
    const clusters: Array<Array<(typeof oklabPixels)[0]>> = Array.from({ length: k }, () => []);

    for (const pixel of oklabPixels) {
      let minDist = Infinity;
      let closest = 0;

      for (let i = 0; i < k; i++) {
        const dl = pixel.oklab.l - centroids[i].oklab.l;
        const da = pixel.oklab.a - centroids[i].oklab.a;
        const db = pixel.oklab.b - centroids[i].oklab.b;
        const dist = Math.sqrt(dl * dl + da * da + db * db);

        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      }
      clusters[closest].push(pixel);
    }

    // Update centroids
    const newCentroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];

      const avgOklab = {
        l: cluster.reduce((sum, p) => sum + p.oklab.l, 0) / cluster.length,
        a: cluster.reduce((sum, p) => sum + p.oklab.a, 0) / cluster.length,
        b: cluster.reduce((sum, p) => sum + p.oklab.b, 0) / cluster.length,
      };

      const oklch = oklabToOklch(avgOklab);
      const rgb = oklchToRgb(oklch);

      return { ...rgb, oklab: avgOklab };
    });

    // Check convergence
    converged = centroids.every(
      (c, i) =>
        Math.abs(c.oklab.l - newCentroids[i].oklab.l) < 0.0001 &&
        Math.abs(c.oklab.a - newCentroids[i].oklab.a) < 0.0001 &&
        Math.abs(c.oklab.b - newCentroids[i].oklab.b) < 0.0001
    );

    centroids = newCentroids;
  }

  // Calculate weights based on cluster sizes
  const clusterSizes = centroids.map((_, i) => {
    return oklabPixels.filter((pixel) => {
      let minDist = Infinity;
      let closest = 0;

      for (let j = 0; j < centroids.length; j++) {
        const dl = pixel.oklab.l - centroids[j].oklab.l;
        const da = pixel.oklab.a - centroids[j].oklab.a;
        const db = pixel.oklab.b - centroids[j].oklab.b;
        const dist = Math.sqrt(dl * dl + da * da + db * db);

        if (dist < minDist) {
          minDist = dist;
          closest = j;
        }
      }
      return closest === i;
    }).length;
  });

  const totalPixels = pixels.length;

  // Sort by cluster size and return with weights
  return centroids
    .map((c, i) => ({
      r: c.r,
      g: c.g,
      b: c.b,
      weight: clusterSizes[i] / totalPixels,
    }))
    .sort((a, b) => b.weight - a.weight);
}

// Extract pixels with better sampling strategy
async function extractPixelsWithSegmentation(
  imageBuffer: Buffer,
  _segments: SegmentationMask[]
): Promise<Array<{ r: number; g: number; b: number }>> {
  const pixels: Array<{ r: number; g: number; b: number }> = [];

  // Sample up to 5000 pixels, skip extremes (shadows/highlights)
  const sampleSize = Math.min(5000, Math.floor(imageBuffer.length / 12));
  const step = Math.max(3, Math.floor(imageBuffer.length / (sampleSize * 3)));

  for (let i = 0; i < imageBuffer.length - 3; i += step * 3) {
    const r = imageBuffer[i];
    const g = imageBuffer[i + 1];
    const b = imageBuffer[i + 2];

    // Filter out extreme values (pure black shadows, pure white highlights)
    const brightness = (r + g + b) / 3;
    if (brightness > 15 && brightness < 240) {
      pixels.push({ r, g, b });
    }
  }

  return pixels;
}

// ============================================
// STAGE 3: COLOR NAMING & METADATA
// ============================================

function getColorName(_rgb: RGBValues, hsl: HSLValues): string {
  const { h, s, l } = hsl;

  // Grayscale detection
  if (s < 10) {
    if (l < 15) return 'Black';
    if (l < 30) return 'Charcoal';
    if (l < 45) return 'Dark Gray';
    if (l < 60) return 'Gray';
    if (l < 75) return 'Silver';
    if (l < 90) return 'Light Gray';
    return 'White';
  }

  // Determine base hue name
  let baseName = '';
  if (h >= 345 || h < 15) baseName = 'Red';
  else if (h < 45) baseName = 'Orange';
  else if (h < 70) baseName = 'Yellow';
  else if (h < 150) baseName = 'Green';
  else if (h < 200) baseName = 'Cyan';
  else if (h < 260) baseName = 'Blue';
  else if (h < 290) baseName = 'Purple';
  else baseName = 'Magenta';

  // Add descriptive modifiers
  if (l < 20) return `Deep ${baseName}`;
  if (l < 35) return `Dark ${baseName}`;
  if (l > 80 && s < 40) return `Light ${baseName}`;
  if (l > 80) return `Pale ${baseName}`;
  if (l > 65 && s > 70) return `Bright ${baseName}`;
  if (s < 30) return `Muted ${baseName}`;
  if (s > 70) return `Vivid ${baseName}`;

  return baseName;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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

function rgbToHsl(r: number, g: number, b: number): HSLValues {
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

function classifyTemperature(hue: number): 'warm' | 'cool' | 'neutral' {
  if ((hue >= 0 && hue <= 60) || (hue >= 300 && hue <= 360)) return 'warm';
  if (hue >= 120 && hue <= 240) return 'cool';
  return 'neutral';
}

// ============================================
// BUILD ALL COLOR FORMATS
// ============================================

function buildColorFormats(rgb: RGBValues): ColorFormats {
  const { r, g, b } = rgb;
  const hex = rgbToHex(r, g, b);

  // OKLCH (perceptually uniform - primary format)
  const oklab = rgbToOklab(r, g, b);
  const oklch = oklabToOklch(oklab);

  // HSL
  const hsl = rgbToHsl(r, g, b);

  // HSB/HSV
  const hsb = rgbToHsb(r, g, b);

  // CMYK
  const cmyk = rgbToCmyk(r, g, b);

  // LAB
  const lab = rgbToLab(r, g, b);

  // LCH (cylindrical LAB)
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

function rgbToHsb(r: number, g: number, b: number) {
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

function rgbToCmyk(r: number, g: number, b: number) {
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

function rgbToLab(r: number, g: number, b: number) {
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

function labToLch(l: number, a: number, b: number) {
  const c = Math.sqrt(a * a + b * b);
  let h = Math.atan2(b, a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return { l, c: Math.round(c), h: Math.round(h) };
}

// ============================================
// ACCESSIBILITY CALCULATIONS (WCAG + APCA)
// ============================================

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(rgb1: RGBValues, rgb2: RGBValues): number {
  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function calculateAPCA(textRgb: RGBValues, bgRgb: RGBValues): number {
  const textY = relativeLuminance(textRgb.r, textRgb.g, textRgb.b);
  const bgY = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  // Simplified APCA calculation
  const contrast = Math.abs(textY - bgY);
  return Math.round(contrast * 100);
}

function buildAccessibilityInfo(rgb: RGBValues): AccessibilityInfo {
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

// ============================================
// TINTS & SHADES (Generated in OKLCH)
// ============================================

function generateTintsShades(
  oklch: OKLCHValues,
  colorName: string
): { tints: TintShade[]; shades: TintShade[] } {
  const tints: TintShade[] = [];
  const shades: TintShade[] = [];

  // Generate 4 tints and 4 shades with perceptually even steps
  for (let i = 1; i <= 4; i++) {
    // Tint: increase lightness
    const tintL = Math.min(oklch.l + i * 0.1, 0.99);
    const tintOklch: OKLCHValues = { l: tintL, c: oklch.c, h: oklch.h };
    const tintRgb = oklchToRgb(tintOklch);
    const tintHex = rgbToHex(tintRgb.r, tintRgb.g, tintRgb.b);

    tints.push({
      level: i * 10,
      hex: tintHex,
      oklch: `oklch(${(tintL * 100).toFixed(2)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`,
      name: `${colorName} ${400 - i * 100}`,
    });

    // Shade: decrease lightness
    const shadeL = Math.max(oklch.l - i * 0.1, 0.01);
    const shadeOklch: OKLCHValues = { l: shadeL, c: oklch.c, h: oklch.h };
    const shadeRgb = oklchToRgb(shadeOklch);
    const shadeHex = rgbToHex(shadeRgb.r, shadeRgb.g, shadeRgb.b);

    shades.push({
      level: i * 10,
      hex: shadeHex,
      oklch: `oklch(${(shadeL * 100).toFixed(2)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`,
      name: `${colorName} ${500 + i * 100}`,
    });
  }

  return { tints, shades };
}

// ============================================
// COLOR HARMONY (Calculated in OKLCH)
// ============================================

function generateHarmonies(oklch: OKLCHValues, _colorName: string): ColorHarmony {
  const rotateHue = (h: number, deg: number) => (h + deg + 360) % 360;

  const makeHarmony = (h: number, name: string) => {
    const harmonicOklch: OKLCHValues = { l: oklch.l, c: oklch.c, h };
    const rgb = oklchToRgb(harmonicOklch);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    return {
      hex,
      oklch: `oklch(${(oklch.l * 100).toFixed(2)}% ${oklch.c.toFixed(3)} ${h.toFixed(1)})`,
      name,
    };
  };

  return {
    complementary: makeHarmony(rotateHue(oklch.h, 180), 'Complementary'),
    analogous: [
      makeHarmony(rotateHue(oklch.h, 30), 'Analogous 1'),
      makeHarmony(rotateHue(oklch.h, -30), 'Analogous 2'),
    ],
    triadic: [
      makeHarmony(rotateHue(oklch.h, 120), 'Triadic 1'),
      makeHarmony(rotateHue(oklch.h, 240), 'Triadic 2'),
    ],
    split_complementary: [
      makeHarmony(rotateHue(oklch.h, 150), 'Split 1'),
      makeHarmony(rotateHue(oklch.h, 210), 'Split 2'),
    ],
  };
}

// ============================================
// EXPORT FORMATS
// ============================================

function generateExports(palette: ExtractedColor[]): ExportFormats {
  // CSS Variables
  const cssVars = palette
    .map((c) => {
      const lines = [`  ${c.metadata.css_variable_name}: ${c.formats.hex};`];
      c.tints.forEach((t, i) =>
        lines.push(`  ${c.metadata.css_variable_name}-${(i + 1) * 100}: ${t.hex};`)
      );
      lines.push(`  ${c.metadata.css_variable_name}-500: ${c.formats.hex};`);
      c.shades.forEach((s, i) =>
        lines.push(`  ${c.metadata.css_variable_name}-${500 + (i + 1) * 100}: ${s.hex};`)
      );
      return lines.join('\n');
    })
    .join('\n\n');

  // Tailwind Config
  const tailwindColors: Record<string, Record<string, string>> = {};
  palette.forEach((c) => {
    const name = c.name.toLowerCase().replace(/\s+/g, '-');
    tailwindColors[name] = {
      50: c.tints[3]?.hex || c.formats.hex,
      100: c.tints[3]?.hex || c.formats.hex,
      200: c.tints[2]?.hex || c.formats.hex,
      300: c.tints[1]?.hex || c.formats.hex,
      400: c.tints[0]?.hex || c.formats.hex,
      500: c.formats.hex,
      600: c.shades[0]?.hex || c.formats.hex,
      700: c.shades[1]?.hex || c.formats.hex,
      800: c.shades[2]?.hex || c.formats.hex,
      900: c.shades[3]?.hex || c.formats.hex,
      DEFAULT: c.formats.hex,
    };
  });

  // Figma Tokens
  const figmaTokens: Record<string, object> = {};
  palette.forEach((c) => {
    const name = c.name.toLowerCase().replace(/\s+/g, '-');
    figmaTokens[name] = {
      value: c.formats.hex,
      type: 'color',
      description: `${c.name} from ${c.source.segment}`,
    };
  });

  // SCSS Variables
  const scssVars = palette
    .map((c) => {
      const name = c.name.toLowerCase().replace(/\s+/g, '-');
      const lines = [`$${name}: ${c.formats.hex};`];
      c.tints.forEach((t, i) => lines.push(`$${name}-${(i + 1) * 100}: ${t.hex};`));
      c.shades.forEach((s, i) => lines.push(`$${name}-${500 + (i + 1) * 100}: ${s.hex};`));
      return lines.join('\n');
    })
    .join('\n\n');

  return {
    css_variables: `:root {\n${cssVars}\n}`,
    tailwind_config: { theme: { extend: { colors: tailwindColors } } },
    figma_tokens: figmaTokens,
    scss_variables: scssVars,
  };
}

// ============================================
// MAIN EXTRACTION PIPELINE
// ============================================

export async function extractColorsFromImage(
  imageBuffer: Buffer,
  filename: string,
  options: { numColors?: number; includeBackground?: boolean; generateHarmonies?: boolean } = {}
): Promise<ColorPaletteResult> {
  const { numColors = 5, generateHarmonies: genHarm = true } = options;

  console.log('🎨 Starting ML Color Extraction Pipeline...');

  // ============================================
  // STAGE 1b: SEMANTIC SEGMENTATION
  // ============================================
  console.log('📊 Stage 1: Semantic Segmentation (SegFormer)...');
  const segments = await callSegFormer(imageBuffer);

  const categories = segments.map((s) => s.label).filter(Boolean);
  console.log(`   ✓ Identified ${categories.length} categories:`, categories.slice(0, 5));

  // ============================================
  // STAGE 2: COLOR EXTRACTION IN OKLCH
  // ============================================
  console.log('🎯 Stage 2: Color Extraction (K-means in OKLCH space)...');

  const pixels = await extractPixelsWithSegmentation(imageBuffer, segments);
  console.log(`   ✓ Sampled ${pixels.length} pixels`);

  const dominantColors = kMeansClusteringOklab(pixels, numColors);
  console.log(`   ✓ Extracted ${dominantColors.length} dominant colors`);

  // ============================================
  // STAGE 3: COLOR NAMING & FORMATTING
  // ============================================
  console.log('🏷️  Stage 3: Color Naming & Format Generation...');

  const palette: ExtractedColor[] = dominantColors.map((colorData, i) => {
    const { r, g, b, weight } = colorData;
    const rgb: RGBValues = { r, g, b };

    // Generate all formats
    const formats = buildColorFormats(rgb);
    const hsl = formats.hsl.values;
    const oklch = formats.oklch.values;

    // Generate name
    const colorName = getColorName(rgb, hsl);

    // Generate tints & shades in OKLCH
    const { tints, shades } = generateTintsShades(oklch, colorName);

    // Generate harmonies
    const harmony = genHarm
      ? generateHarmonies(oklch, colorName)
      : {
          complementary: { hex: '', oklch: '', name: '' },
          analogous: [],
          triadic: [],
          split_complementary: [],
        };

    // Build accessibility info
    const accessibility = buildAccessibilityInfo(rgb);

    // Determine segment (foreground vs background based on weight)
    const segment = i < Math.ceil(numColors / 2) ? 'foreground' : 'background';
    const category = segments.find((s) => s.score > 0.5)?.label || 'unknown';

    return {
      id: `color_${String(i + 1).padStart(3, '0')}`,
      name: colorName,
      source: {
        segment,
        category,
        pixel_coverage: weight,
        confidence: 0.85 + weight * 0.15, // Higher weight = higher confidence
      },
      formats,
      accessibility,
      tints,
      shades,
      harmony,
      metadata: {
        temperature: classifyTemperature(hsl.h),
        nearest_css_color: colorName.toLowerCase(),
        css_variable_name: `--color-${colorName.toLowerCase().replace(/\s+/g, '-')}`,
      },
    };
  });

  console.log('   ✓ Generated complete palette with all formats');

  // ============================================
  // STAGE 4: EXPORT GENERATION
  // ============================================
  console.log('📦 Stage 4: Generating exports (CSS, Tailwind, Figma, SCSS)...');
  const exports = generateExports(palette);

  // Calculate segment distribution
  const foregroundPixels = dominantColors
    .slice(0, Math.ceil(numColors / 2))
    .reduce((sum, c) => sum + c.weight, 0);
  const backgroundPixels = 1 - foregroundPixels;

  const segmentInfo: SegmentInfo = {
    foreground: { pixel_percentage: Math.round(foregroundPixels * 100 * 10) / 10 },
    background: { pixel_percentage: Math.round(backgroundPixels * 100 * 10) / 10 },
    categories,
  };

  console.log('✨ Pipeline complete!');
  console.log(`   Colors: ${palette.map((c) => c.name).join(', ')}`);

  return {
    id: `palette_${Date.now()}`,
    source_image: {
      filename,
      dimensions: { width: 0, height: 0 }, // Would need sharp library to get actual dimensions
      processed_at: new Date().toISOString(),
    },
    segments: segmentInfo,
    palette,
    exports,
  };
}
