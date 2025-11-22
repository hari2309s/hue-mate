import sharp from 'sharp';
import namer from 'color-namer';
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

const HF_API_URL = 'https://router.huggingface.co/hf-inference/models';
const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;

// ============================================
// STAGE 1a: FOREGROUND/BACKGROUND SEGMENTATION
// Using facebook/mask2former-swin-base-coco-panoptic
// ============================================

const FOREGROUND_BACKGROUND_SEGMENTATION_MODEL = 'facebook/mask2former-swin-base-coco-panoptic';

interface ForegroundMask {
  mask: Buffer;
  foreground_percentage: number;
}

async function callForegroundSegmentation(imageBuffer: Buffer): Promise<ForegroundMask | null> {
  try {
    console.log(
      '   → Calling facebook/mask2former-swin-base-coco-panoptic for foreground/background separation...'
    );
    const response = await fetch(`${HF_API_URL}/${FOREGROUND_BACKGROUND_SEGMENTATION_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      if (response.status === 503) {
        console.log('   → Model loading, waiting 20 seconds...');
        await new Promise((r) => setTimeout(r, 20000));
        return callForegroundSegmentation(imageBuffer);
      }
      console.log(`   ✗ ModNet failed with status ${response.status}, continuing without it`);
      return null;
    }

    const maskBuffer = Buffer.from(await response.arrayBuffer());
    const maskImage = sharp(maskBuffer);
    const { data } = await maskImage.raw().greyscale().toBuffer({ resolveWithObject: true });

    let foregroundPixels = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > 128) foregroundPixels++;
    }

    const foreground_percentage = (foregroundPixels / data.length) * 100;
    console.log(`   ✓ Foreground: ${foreground_percentage.toFixed(1)}%`);
    return { mask: maskBuffer, foreground_percentage };
  } catch (error) {
    console.log(
      `   ✗ ${FOREGROUND_BACKGROUND_SEGMENTATION_MODEL} segmentation failed, continuing without it`
    );
    return null;
  }
}

// ============================================
// STAGE 1b: SEMANTIC SEGMENTATION
// Using nvidia/segformer-b0-finetuned-ade-512-512
// ============================================

const SEGFORMER_MODEL = 'nvidia/segformer-b0-finetuned-ade-512-512';

interface SegmentationResult {
  label: string;
  score: number;
  mask?: string;
}

async function callSegFormer(imageBuffer: Buffer): Promise<SegmentationResult[]> {
  try {
    console.log('   → Calling SegFormer for semantic segmentation...');

    // Resize image for SegFormer (max 640x640)
    const resizedBuffer = await sharp(imageBuffer)
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    const response = await fetch(`${HF_API_URL}/${SEGFORMER_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: resizedBuffer,
    });

    if (!response.ok) {
      if (response.status === 503) {
        console.log('   → Model loading, waiting 20 seconds...');
        await new Promise((r) => setTimeout(r, 20000));
        return callSegFormer(imageBuffer);
      }
      console.log(`   ✗ SegFormer failed with status ${response.status}, continuing without it`);
      return [];
    }

    const results = (await response.json()) as SegmentationResult[];
    console.log(`   ✓ Found ${results.length} semantic regions`);
    return results;
  } catch (error) {
    console.log('   ✗ SegFormer segmentation failed, continuing without it');
    return [];
  }
}

// ============================================
// PANTONE APPROXIMATION
// ============================================

// Pantone color database (subset of common colors)
const PANTONE_COLORS = [
  { name: 'PANTONE 18-1664 TCX Flame Scarlet', rgb: { r: 205, g: 33, b: 42 } },
  { name: 'PANTONE 18-1663 TCX Fiery Red', rgb: { r: 206, g: 41, b: 57 } },
  { name: 'PANTONE 19-1664 TCX Racing Red', rgb: { r: 193, g: 35, b: 48 } },
  { name: 'PANTONE 15-1264 TCX Living Coral', rgb: { r: 250, g: 114, b: 104 } },
  { name: 'PANTONE 17-1564 TCX Burnt Sienna', rgb: { r: 165, g: 82, b: 63 } },
  { name: 'PANTONE 18-1438 TCX Autumn Maple', rgb: { r: 194, g: 80, b: 51 } },
  { name: 'PANTONE 16-1449 TCX Tangerine', rgb: { r: 250, g: 106, b: 56 } },
  { name: 'PANTONE 15-1333 TCX Apricot', rgb: { r: 236, g: 145, b: 92 } },
  { name: 'PANTONE 14-1064 TCX Peach', rgb: { r: 255, g: 183, b: 135 } },
  { name: 'PANTONE 13-0942 TCX Lemon', rgb: { r: 253, g: 214, b: 99 } },
  { name: 'PANTONE 14-0756 TCX Mustard', rgb: { r: 214, g: 170, b: 61 } },
  { name: 'PANTONE 15-0751 TCX Golden Glow', rgb: { r: 234, g: 170, b: 0 } },
  { name: 'PANTONE 19-0622 TCX Olive', rgb: { r: 86, g: 86, b: 57 } },
  { name: 'PANTONE 18-0426 TCX Forest', rgb: { r: 67, g: 86, b: 54 } },
  { name: 'PANTONE 15-6442 TCX Mint', rgb: { r: 152, g: 212, b: 187 } },
  { name: 'PANTONE 17-5641 TCX Teal', rgb: { r: 0, g: 128, b: 128 } },
  { name: 'PANTONE 18-5025 TCX Deep Teal', rgb: { r: 26, g: 95, b: 90 } },
  { name: 'PANTONE 19-4056 TCX Blue Depths', rgb: { r: 42, g: 72, b: 88 } },
  { name: 'PANTONE 18-4051 TCX Mosaic Blue', rgb: { r: 0, g: 114, b: 155 } },
  { name: 'PANTONE 17-4041 TCX Aqua', rgb: { r: 100, g: 200, b: 215 } },
  { name: 'PANTONE 19-4052 TCX Classic Blue', rgb: { r: 15, g: 76, b: 129 } },
  { name: 'PANTONE 18-3949 TCX Purple', rgb: { r: 104, g: 69, b: 114 } },
  { name: 'PANTONE 18-3633 TCX Magenta', rgb: { r: 208, g: 65, b: 126 } },
  { name: 'PANTONE 19-2428 TCX Wine', rgb: { r: 114, g: 47, b: 55 } },
  { name: 'PANTONE 19-1420 TCX Chocolate', rgb: { r: 92, g: 58, b: 38 } },
  { name: 'PANTONE 19-1015 TCX Coffee', rgb: { r: 78, g: 59, b: 47 } },
  { name: 'PANTONE 11-0601 TCX White', rgb: { r: 244, g: 244, b: 242 } },
  { name: 'PANTONE 19-0303 TCX Black', rgb: { r: 40, g: 40, b: 40 } },
];

function findNearestPantone(rgb: RGBValues): string {
  let minDistance = Infinity;
  let nearestPantone = 'PANTONE N/A';

  for (const pantone of PANTONE_COLORS) {
    // Calculate Euclidean distance in RGB space
    const distance = Math.sqrt(
      Math.pow(rgb.r - pantone.rgb.r, 2) +
        Math.pow(rgb.g - pantone.rgb.g, 2) +
        Math.pow(rgb.b - pantone.rgb.b, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestPantone = pantone.name;
    }
  }

  return nearestPantone;
}

// ============================================
// STAGE 2: COLOR EXTRACTION & QUANTIZATION
// ============================================

function rgbToOklab(r: number, g: number, b: number): { l: number; a: number; b: number } {
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

function oklchToRgb(oklch: OKLCHValues): RGBValues {
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

  centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });

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

function kMeansClusteringOklab(
  pixels: Array<{ r: number; g: number; b: number }>,
  k: number,
  maxIterations: number = 100
): Array<{ r: number; g: number; b: number; weight: number }> {
  if (pixels.length === 0) return [];
  if (pixels.length <= k) return pixels.map((p) => ({ ...p, weight: 1 / pixels.length }));

  const oklabPixels = pixels.map((p) => ({
    ...p,
    oklab: rgbToOklab(p.r, p.g, p.b),
  }));

  let centroids = kMeansPlusPlus(oklabPixels, k);
  let converged = false;
  let iteration = 0;

  while (!converged && iteration < maxIterations) {
    iteration++;

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

    converged = centroids.every(
      (c, i) =>
        Math.abs(c.oklab.l - newCentroids[i].oklab.l) < 0.0001 &&
        Math.abs(c.oklab.a - newCentroids[i].oklab.a) < 0.0001 &&
        Math.abs(c.oklab.b - newCentroids[i].oklab.b) < 0.0001
    );

    centroids = newCentroids;
  }

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

  return centroids
    .map((c, i) => ({
      r: c.r,
      g: c.g,
      b: c.b,
      weight: clusterSizes[i] / totalPixels,
    }))
    .sort((a, b) => b.weight - a.weight);
}

async function extractPixelsWithSharp(
  imageBuffer: Buffer,
  foregroundMask: ForegroundMask | null
): Promise<{ pixels: Array<{ r: number; g: number; b: number }>; isForeground: boolean[] }> {
  const pixels: Array<{ r: number; g: number; b: number }> = [];
  const isForeground: boolean[] = [];

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  console.log(`   ✓ Image dimensions: ${metadata.width}x${metadata.height}`);

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  let maskData: Buffer | null = null;
  if (foregroundMask) {
    const resizedMask = await sharp(foregroundMask.mask)
      .resize(info.width, info.height, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();
    maskData = resizedMask;
  }

  const totalPixels = info.width * info.height;
  const maxSamples = 5000;
  const sampleRate = Math.max(1, Math.floor(totalPixels / maxSamples));

  console.log(`   ✓ Sampling every ${sampleRate} pixel(s) from ${totalPixels} total`);

  for (let i = 0; i < data.length; i += sampleRate * info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const brightness = (r + g + b) / 3;
    if (brightness > 15 && brightness < 240) {
      pixels.push({ r, g, b });

      if (maskData) {
        const maskIndex = Math.floor(i / info.channels);
        const isFg = maskData[maskIndex] > 128;
        isForeground.push(isFg);
      } else {
        isForeground.push(true); // Default to foreground if no mask
      }
    }
  }

  return { pixels, isForeground };
}

// ============================================
// STAGE 3: COLOR NAMING WITH CONTEXT
// ============================================

function getEnhancedColorName(rgb: RGBValues, category?: string): string {
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

  // Use color-namer for rich naming
  const names = namer(hex);

  // Prioritize NTC names (most descriptive), fallback to basic
  const ntcName = names.ntc[0]?.name || '';
  const basicName = names.basic[0]?.name || '';
  const bestName = ntcName || basicName || 'Unknown';

  // Clean up the name (capitalize properly)
  const cleanName = bestName
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Only add category prefix for specific, meaningful categories
  if (category && category !== 'unknown') {
    const meaningfulCategories: Record<string, string> = {
      sky: 'Sky',
      sea: 'Ocean',
      water: 'Water',
      plant: 'Leaf',
      tree: 'Forest',
      grass: 'Meadow',
      sand: 'Sand',
      mountain: 'Stone',
      building: 'Stone',
      wall: 'Wall',
      wood: 'Wood',
    };

    const prefix = meaningfulCategories[category.toLowerCase()];
    if (prefix) {
      return `${prefix} ${cleanName}`;
    }
  }

  return cleanName;
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

function buildColorFormats(rgb: RGBValues): ColorFormats {
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
// ACCESSIBILITY CALCULATIONS
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
// TINTS & SHADES
// ============================================

function generateTintsShades(
  oklch: OKLCHValues,
  colorName: string
): { tints: TintShade[]; shades: TintShade[] } {
  const tints: TintShade[] = [];
  const shades: TintShade[] = [];

  for (let i = 1; i <= 4; i++) {
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
// COLOR HARMONY
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

  const figmaTokens: Record<string, object> = {};
  palette.forEach((c) => {
    const name = c.name.toLowerCase().replace(/\s+/g, '-');
    figmaTokens[name] = {
      value: c.formats.hex,
      type: 'color',
      description: `${c.name} from ${c.source.segment}`,
    };
  });

  const scssVars = palette
    .map((c) => {
      const name = c.name.toLowerCase().replace(/\s+/g, '-');
      const lines = [`${name}: ${c.formats.hex};`];
      c.tints.forEach((t, i) => lines.push(`${name}-${(i + 1) * 100}: ${t.hex};`));
      c.shades.forEach((s, i) => lines.push(`${name}-${500 + (i + 1) * 100}: ${s.hex};`));
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

  console.log('🎨 Starting Enhanced ML Color Extraction Pipeline...');

  // ============================================
  // STAGE 1a: FOREGROUND/BACKGROUND SEGMENTATION
  // ============================================
  console.log('📐 Stage 1a: Foreground/Background Segmentation...');
  const foregroundMask = await callForegroundSegmentation(imageBuffer);

  // ============================================
  // STAGE 1b: SEMANTIC SEGMENTATION
  // ============================================
  console.log('📊 Stage 1b: Semantic Segmentation (SegFormer)...');
  const segments = await callSegFormer(imageBuffer);

  const categories = segments.map((s) => s.label).filter(Boolean);
  if (categories.length > 0) {
    console.log(`   ✓ Identified ${categories.length} semantic regions`);
  }

  // ============================================
  // STAGE 2: IMAGE METADATA & PIXEL EXTRACTION
  // ============================================
  console.log('🎯 Stage 2: Pixel Extraction with Segmentation...');
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  console.log(`   ✓ Image: ${metadata.width}x${metadata.height} (${metadata.format})`);

  const { pixels, isForeground } = await extractPixelsWithSharp(imageBuffer, foregroundMask);
  console.log(`   ✓ Sampled ${pixels.length} pixels`);

  // Separate foreground and background pixels
  let fgPixels = pixels.filter((_, i) => isForeground[i]);
  let bgPixels = pixels.filter((_, i) => !isForeground[i]);

  // If no proper separation, split 60/40 based on luminance
  if (fgPixels.length === 0 || bgPixels.length === 0) {
    console.log('   → No mask available, splitting by luminance...');
    const pixelsWithLum = pixels.map((p) => ({
      ...p,
      lum: 0.299 * p.r + 0.587 * p.g + 0.114 * p.b,
    }));
    pixelsWithLum.sort((a, b) => b.lum - a.lum);
    const splitPoint = Math.floor(pixels.length * 0.4);
    fgPixels = pixelsWithLum.slice(0, splitPoint);
    bgPixels = pixelsWithLum.slice(splitPoint);
  }

  console.log(`   ✓ Foreground: ${fgPixels.length} pixels, Background: ${bgPixels.length} pixels`);

  // ============================================
  // STAGE 3: COLOR EXTRACTION (K-MEANS IN OKLCH)
  // ============================================
  console.log('🔬 Stage 3: K-means Clustering in OKLCH space...');

  const fgColors = Math.ceil(numColors * 0.6); // 60% from foreground
  const bgColors = Math.floor(numColors * 0.4); // 40% from background

  const dominantFgColors = fgPixels.length > 0 ? kMeansClusteringOklab(fgPixels, fgColors) : [];
  const dominantBgColors = bgPixels.length > 0 ? kMeansClusteringOklab(bgPixels, bgColors) : [];

  console.log(
    `   ✓ Extracted ${dominantFgColors.length} foreground + ${dominantBgColors.length} background colors`
  );

  // ============================================
  // STAGE 4: COLOR NAMING & ENRICHMENT
  // ============================================
  console.log('🏷️  Stage 4: Enhanced Color Naming & Metadata...');

  const palette: ExtractedColor[] = [];

  // Process foreground colors
  dominantFgColors.forEach((colorData, _i) => {
    const { r, g, b, weight } = colorData;
    const rgb: RGBValues = { r, g, b };

    const formats = buildColorFormats(rgb);
    const hsl = formats.hsl.values;
    const oklch = formats.oklch.values;

    // Find dominant category for this color
    const dominantCategory = segments[0]?.label || 'unknown';

    // Enhanced color naming with context
    const colorName = getEnhancedColorName(rgb, dominantCategory);

    const { tints, shades } = generateTintsShades(oklch, colorName);
    const harmony = genHarm ? generateHarmonies(oklch, colorName) : ({} as ColorHarmony);
    const accessibility = buildAccessibilityInfo(rgb);
    const pantone = findNearestPantone(rgb);

    palette.push({
      id: `color_${String(palette.length + 1).padStart(3, '0')}`,
      name: colorName,
      source: {
        segment: 'foreground',
        category: dominantCategory,
        pixel_coverage: weight,
        confidence: 0.85 + weight * 0.15,
      },
      formats,
      accessibility,
      tints,
      shades,
      harmony,
      metadata: {
        temperature: classifyTemperature(hsl.h),
        nearest_css_color: colorName.toLowerCase(),
        pantone_approximation: pantone,
        css_variable_name: `--color-${colorName.toLowerCase().replace(/\s+/g, '-')}`,
      },
    });
  });

  // Process background colors
  dominantBgColors.forEach((colorData, _i) => {
    const { r, g, b, weight } = colorData;
    const rgb: RGBValues = { r, g, b };

    const formats = buildColorFormats(rgb);
    const hsl = formats.hsl.values;
    const oklch = formats.oklch.values;

    const dominantCategory = segments[segments.length - 1]?.label || 'unknown';
    const colorName = getEnhancedColorName(rgb, dominantCategory);

    const { tints, shades } = generateTintsShades(oklch, colorName);
    const harmony = genHarm ? generateHarmonies(oklch, colorName) : ({} as ColorHarmony);
    const accessibility = buildAccessibilityInfo(rgb);
    const pantone = findNearestPantone(rgb);

    palette.push({
      id: `color_${String(palette.length + 1).padStart(3, '0')}`,
      name: colorName,
      source: {
        segment: 'background',
        category: dominantCategory,
        pixel_coverage: weight,
        confidence: 0.75 + weight * 0.15,
      },
      formats,
      accessibility,
      tints,
      shades,
      harmony,
      metadata: {
        temperature: classifyTemperature(hsl.h),
        nearest_css_color: colorName.toLowerCase(),
        pantone_approximation: pantone,
        css_variable_name: `--color-${colorName.toLowerCase().replace(/\s+/g, '-')}`,
      },
    });
  });

  console.log('   ✓ Generated enhanced palette with context-aware names');

  // ============================================
  // STAGE 5: EXPORT GENERATION
  // ============================================
  console.log('📦 Stage 5: Generating exports...');
  const exports = generateExports(palette);

  const segmentInfo: SegmentInfo = {
    foreground: {
      pixel_percentage: foregroundMask
        ? Math.round(foregroundMask.foreground_percentage * 10) / 10
        : 50,
    },
    background: {
      pixel_percentage: foregroundMask
        ? Math.round((100 - foregroundMask.foreground_percentage) * 10) / 10
        : 50,
    },
    categories,
  };

  console.log('✨ Enhanced Pipeline Complete!');
  console.log(`   Colors: ${palette.map((c) => c.name).join(', ')}`);

  return {
    id: `palette_${Date.now()}`,
    source_image: {
      filename,
      dimensions: { width: metadata.width || 0, height: metadata.height || 0 },
      processed_at: new Date().toISOString(),
    },
    segments: segmentInfo,
    palette,
    exports,
  };
}
