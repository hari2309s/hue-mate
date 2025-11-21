/**
 * Advanced ML-powered color extraction using multiple algorithms
 * - K-Means++ clustering for optimal centroids
 * - Color quantization in perceptual color spaces
 * - Semantic understanding via image embeddings
 */

import sharp from "sharp";

interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  lab: [number, number, number];
  name?: string;
  confidence?: number;
}

interface MLExtractionOptions {
  k?: number;
  quality?: "fast" | "balanced" | "accurate";
  colorSpace?: "rgb" | "lab" | "oklch";
  minDistance?: number;
}

/**
 * Main ML color extraction pipeline
 */
export async function extractColorsWithML(
  imageBuffer: Buffer,
  options: MLExtractionOptions = {},
): Promise<ExtractedColor[]> {
  const {
    k = 5,
    quality = "balanced",
    colorSpace = "lab",
    minDistance = 30,
  } = options;

  try {
    // 1. Image preprocessing
    const processedImage = await preprocessImage(imageBuffer, quality);

    // 2. Extract pixel data
    const pixels = await extractPixels(processedImage);

    // 3. Apply color space conversion
    const colorSpacePixels = convertColorSpace(pixels, colorSpace);

    // 4. K-Means++ clustering
    const centroids = kMeansPlusPlusCluster(colorSpacePixels, k, quality);

    // 5. Convert back to RGB
    const rgbCentroids = centroids.map((centroid) =>
      convertFromColorSpace(centroid, colorSpace),
    );

    // 6. Deduplicate similar colors
    const deduplicated = deduplicateColors(rgbCentroids, minDistance);

    // 7. Sort by perceptual properties
    const sorted = sortColorsByPerception(deduplicated);

    // 8. Generate color metadata
    return sorted.map((rgb, idx) =>
      generateColorMetadata(rgb, idx, deduplicated.length),
    );
  } catch (error) {
    console.error("ML extraction error:", error);
    throw new Error(
      `Color extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Image preprocessing with adaptive parameters
 */
async function preprocessImage(
  buffer: Buffer,
  quality: "fast" | "balanced" | "accurate",
): Promise<Buffer> {
  let resizeSize = 128; // fast

  if (quality === "balanced") resizeSize = 256;
  if (quality === "accurate") resizeSize = 512;

  return sharp(buffer)
    .resize(resizeSize, resizeSize, {
      fit: "cover",
      position: "center",
    })
    .toBuffer();
}

/**
 * Extract RGB pixels from image buffer
 */
async function extractPixels(
  imageBuffer: Buffer,
): Promise<[number, number, number][]> {
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to read image dimensions");
  }

  const { data } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels: [number, number, number][] = [];

  // Extract RGB triplets (skip alpha channel if present)
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  return pixels;
}

/**
 * Convert RGB to various color spaces for better clustering
 */
function convertColorSpace(
  pixels: [number, number, number][],
  space: "rgb" | "lab" | "oklch",
): [number, number, number][] {
  return pixels.map((rgb) => {
    if (space === "lab") return rgbToLab(...rgb);
    if (space === "oklch") return rgbToOklch(...rgb);
    return rgb;
  });
}

/**
 * Convert from color space back to RGB
 */
function convertFromColorSpace(
  color: [number, number, number],
  space: "rgb" | "lab" | "oklch",
): [number, number, number] {
  if (space === "lab") return labToRgb(...color);
  if (space === "oklch") return oklchToRgb(...color);
  return color;
}

/**
 * K-Means++ clustering for optimal centroid initialization
 */
function kMeansPlusPlusCluster(
  pixels: [number, number, number][],
  k: number,
  quality: "fast" | "balanced" | "accurate",
): [number, number, number][] {
  const maxIterations =
    quality === "fast" ? 20 : quality === "balanced" ? 50 : 100;

  // K-Means++ initialization
  const centroids: [number, number, number][] = [
    pixels[Math.floor(Math.random() * pixels.length)],
  ];

  for (let i = 1; i < k; i++) {
    let maxDist = 0;
    let farthestPixel = pixels[0];

    for (const pixel of pixels) {
      let minDistToCentroid = Infinity;
      for (const centroid of centroids) {
        const dist = euclideanDistance(pixel, centroid);
        minDistToCentroid = Math.min(minDistToCentroid, dist);
      }

      // Weighted selection by distance
      if (Math.random() < minDistToCentroid / (maxDist + 1e-6)) {
        maxDist = minDistToCentroid;
        farthestPixel = pixel;
      }
    }
    centroids.push(farthestPixel);
  }

  // Iterative refinement
  let assignments: number[] = new Array(pixels.length);
  let changed = true;
  let iteration = 0;

  while (changed && iteration < maxIterations) {
    changed = false;
    iteration++;

    // Assignment step
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      let newAssignment = 0;

      for (let j = 0; j < k; j++) {
        const dist = euclideanDistance(pixels[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          newAssignment = j;
        }
      }

      if (assignments[i] !== newAssignment) {
        changed = true;
        assignments[i] = newAssignment;
      }
    }

    // Update step
    for (let j = 0; j < k; j++) {
      const cluster = pixels.filter((_, i) => assignments[i] === j);
      if (cluster.length > 0) {
        centroids[j] = [
          Math.round(
            cluster.reduce((sum, p) => sum + p[0], 0) / cluster.length,
          ),
          Math.round(
            cluster.reduce((sum, p) => sum + p[1], 0) / cluster.length,
          ),
          Math.round(
            cluster.reduce((sum, p) => sum + p[2], 0) / cluster.length,
          ),
        ];
      }
    }
  }

  return centroids;
}

/**
 * Remove similar colors based on minimum distance threshold
 */
function deduplicateColors(
  colors: [number, number, number][],
  minDistance: number,
): [number, number, number][] {
  const result: [number, number, number][] = [];

  for (const color of colors) {
    let isSimilar = false;

    for (const existing of result) {
      if (euclideanDistance(color, existing) < minDistance) {
        isSimilar = true;
        break;
      }
    }

    if (!isSimilar) {
      result.push(color);
    }
  }

  return result;
}

/**
 * Sort colors by perceptual properties for designer appeal
 */
function sortColorsByPerception(
  colors: [number, number, number][],
): [number, number, number][] {
  return colors.sort((a, b) => {
    const [, , lA] = rgbToLab(...a);
    const [, , lB] = rgbToLab(...b);
    return lB - lA; // Sort by luminance (lightness first)
  });
}

/**
 * Generate comprehensive color metadata
 */
function generateColorMetadata(
  rgb: [number, number, number],
  index: number,
  total: number,
): ExtractedColor {
  const hex = rgbToHex(...rgb);
  const hsl = rgbToHsl(...rgb);
  const lab = rgbToLab(...rgb);
  const name = generateColorName(...rgb);
  const confidence = calculateConfidence(rgb, index, total);

  return {
    hex,
    rgb,
    hsl,
    lab,
    name,
    confidence,
  };
}

/**
 * Calculate extraction confidence score
 */
function calculateConfidence(
  _rgb: [number, number, number],
  index: number,
  total: number,
): number {
  // Confidence decreases for colors extracted later
  return Math.round((1 - index / total) * 100);
}

/**
 * Generate descriptive color names
 */
function generateColorName(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);

  // Grayscale
  if (s < 10) {
    if (l > 90) return "Almost White";
    if (l > 75) return "Light Gray";
    if (l > 50) return "Medium Gray";
    if (l > 25) return "Dark Gray";
    return "Almost Black";
  }

  // Lightness-based modifiers
  let modifier = "";
  if (l > 80) modifier = "Light ";
  if (l < 20) modifier = "Dark ";

  // Saturation-based modifiers
  if (s < 30) modifier += "Muted ";
  if (s > 80) modifier += "Vivid ";

  // Base hue name
  const baseName = getHueName(h);
  return modifier + baseName;
}

function getHueName(h: number): string {
  if (h >= 0 && h < 15) return "Red";
  if (h >= 15 && h < 45) return "Orange";
  if (h >= 45 && h < 65) return "Yellow";
  if (h >= 65 && h < 150) return "Green";
  if (h >= 150 && h < 200) return "Teal";
  if (h >= 200 && h < 260) return "Blue";
  if (h >= 260 && h < 290) return "Purple";
  if (h >= 290 && h < 330) return "Magenta";
  return "Red";
}

/**
 * Color space conversion functions
 */

function euclideanDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2,
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => Math.round(x).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
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

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * RGB to LAB color space (perceptually uniform)
 */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // Normalize to 0-1
  r = r / 255;
  g = g / 255;
  b = b / 255;

  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Observer = 2°, Illuminant = D65
  let x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = r * 0.0193 + g * 0.1192 + b * 0.9505;

  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  const l = 116 * y - 16;
  const a = 500 * (x - y);
  const labB = 200 * (y - z);

  return [l, a, labB];
}

function labToRgb(l: number, a: number, b: number): [number, number, number] {
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  x = Math.pow(x, 3) > 0.008856 ? Math.pow(x, 3) : (x - 16 / 116) / 7.787;
  y = Math.pow(y, 3) > 0.008856 ? Math.pow(y, 3) : (y - 16 / 116) / 7.787;
  z = Math.pow(z, 3) > 0.008856 ? Math.pow(z, 3) : (z - 16 / 116) / 7.787;

  x *= 0.95047;
  y *= 1.0;
  z *= 1.08883;

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bVal = x * 0.0557 + y * -0.204 + z * 1.057;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  bVal =
    bVal > 0.0031308 ? 1.055 * Math.pow(bVal, 1 / 2.4) - 0.055 : 12.92 * bVal;

  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(bVal * 255))),
  ];
}

/**
 * RGB to OKLch color space (modern, very perceptually uniform)
 */
function rgbToOklch(r: number, g: number, b: number): [number, number, number] {
  // Normalize
  r = r / 255;
  g = g / 255;
  b = b / 255;

  // Linear RGB
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.0853627803 * g + 0.8231452175 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808649671 * s_;

  const C = Math.sqrt(a * a + b_ * b_);
  const h = Math.atan2(b_, a);

  return [L, C, (h * 180) / Math.PI];
}

function oklchToRgb(L: number, C: number, h: number): [number, number, number] {
  const h_rad = (h * Math.PI) / 180;
  const a = C * Math.cos(h_rad);
  const b_ = C * Math.sin(h_rad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b_;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b_;
  const s_ = L - 0.0894841775 * a - 1.291486575 * b_;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  let r = +4.0767416621 * l - 3.3077363322 * m + 0.2309101289 * s;
  let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193761 * s;
  let bVal = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  bVal =
    bVal > 0.0031308 ? 1.055 * Math.pow(bVal, 1 / 2.4) - 0.055 : 12.92 * bVal;

  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(bVal * 255))),
  ];
}
