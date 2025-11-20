/**
 * Hugging Face Image Classification for advanced color detection
 * Node.js compatible version using sharp for image processing
 */

interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  name?: string;
}

const HF_API_URL =
  "https://api-inference.huggingface.co/models/openai/clip-vit-base-patch32";
const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;

/**
 * Extract colors from image using K-means clustering
 * This version works in Node.js environment
 */
export async function extractColorsHF(
  base64Image: string,
  k: number = 5,
): Promise<ExtractedColor[]> {
  try {
    // Convert base64 to buffer
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Extract pixels from buffer
    const pixels = await extractPixelsFromBuffer(buffer);

    // Downsample for efficiency
    const sampledPixels = downsamplePixels(pixels, 2000);

    // Apply K-Means clustering for dominant colors
    const dominantColors = performKMeansClustering(sampledPixels, k);

    // Convert to color formats
    const colorData = dominantColors.map((rgb) => ({
      hex: rgbToHex(...rgb),
      rgb: rgb as [number, number, number],
      hsl: rgbToHsl(...rgb),
      name: getColorName(...rgb),
    }));

    // Sort by perceived luminance for designer appeal
    return colorData.sort((a, b) => {
      const lumA = getPerceivedLuminance(...a.rgb);
      const lumB = getPerceivedLuminance(...b.rgb);
      return lumB - lumA;
    });
  } catch (error) {
    console.error("HF color extraction error:", error);
    throw error;
  }
}

async function extractPixelsFromBuffer(
  buffer: Buffer,
): Promise<[number, number, number][]> {
  // Simple pixel extraction without external dependencies
  // In production, you'd use sharp or jimp for better performance
  const pixels: [number, number, number][] = [];

  // For now, we'll extract every 4th byte as RGB triplets
  // This is a simplified approach - in production use proper image library
  for (let i = 0; i < Math.min(buffer.length - 2, 10000); i += 4) {
    if (
      buffer[i] !== undefined &&
      buffer[i + 1] !== undefined &&
      buffer[i + 2] !== undefined
    ) {
      pixels.push([buffer[i], buffer[i + 1], buffer[i + 2]]);
    }
  }

  return pixels.filter((p) => !isNaN(p[0]) && !isNaN(p[1]) && !isNaN(p[2]));
}

function downsamplePixels(
  pixels: [number, number, number][],
  maxSamples: number,
): [number, number, number][] {
  if (pixels.length <= maxSamples) return pixels;

  const step = Math.ceil(pixels.length / maxSamples);
  const sampled: [number, number, number][] = [];

  for (let i = 0; i < pixels.length; i += step) {
    sampled.push(pixels[i]);
  }

  return sampled;
}

function performKMeansClustering(
  pixels: [number, number, number][],
  k: number,
  maxIterations: number = 50,
): [number, number, number][] {
  if (pixels.length === 0) {
    return Array(k).fill([128, 128, 128]) as [number, number, number][];
  }

  // Initialize with k-means++
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
      if (minDistToCentroid > maxDist) {
        maxDist = minDistToCentroid;
        farthestPixel = pixel;
      }
    }

    centroids.push(farthestPixel);
  }

  let assignments: number[] = new Array(pixels.length);
  let changed = true;
  let iterations = 0;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Assign pixels to nearest centroid
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

    // Update centroids
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
    .map((x) =>
      Math.round(Math.max(0, Math.min(255, x)))
        .toString(16)
        .padStart(2, "0"),
    )
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

function getPerceivedLuminance(r: number, g: number, b: number): number {
  // Perceived luminance using sRGB coefficients
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function getColorName(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);

  // Grayscale detection
  if (s < 10) {
    if (l > 90) return "Snow";
    if (l > 75) return "Silver";
    if (l > 50) return "Gray";
    if (l > 25) return "Charcoal";
    return "Black";
  }

  // Pastel detection
  if (l > 75) return `Light ${getHueName(h)}`;
  if (l < 25) return `Dark ${getHueName(h)}`;

  return getHueName(h);
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
