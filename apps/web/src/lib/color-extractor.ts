/**
 * Advanced color extraction from images using K-Means clustering
 * No external color extraction libraries - pure algorithmic implementation
 */

interface ColorData {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  name?: string;
}

export async function extractColorsFromImage(
  file: File,
  k: number = 5,
): Promise<ColorData[]> {
  const imageData = await getImageData(file);
  const pixels = imageDataToPixels(imageData);

  // K-Means clustering for dominant colors
  const dominantColors = kMeansClustering(pixels, k);

  // Convert to color formats
  const colorData = dominantColors.map((rgb) => ({
    hex: rgbToHex(...rgb),
    rgb: rgb as [number, number, number],
    hsl: rgbToHsl(...rgb),
    name: getColorName(...rgb),
  }));

  // Sort by luminance (perceptually appealing order)
  return colorData.sort((a, b) => {
    const lumA = getLuminance(...a.rgb);
    const lumB = getLuminance(...b.rgb);
    return lumB - lumA;
  });
}

function getImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function imageDataToPixels(imageData: ImageData): [number, number, number][] {
  const data = imageData.data;
  const pixels: [number, number, number][] = [];

  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  return pixels;
}

function kMeansClustering(
  pixels: [number, number, number][],
  k: number,
): [number, number, number][] {
  // Initialize centroids randomly
  let centroids: [number, number, number][] = [];
  for (let i = 0; i < k; i++) {
    centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
  }

  let assignments: number[] = new Array(pixels.length);
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 50) {
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
    const newCentroids: [number, number, number][] = [];
    for (let j = 0; j < k; j++) {
      const cluster = pixels.filter((_, i) => assignments[i] === j);
      if (cluster.length > 0) {
        const avg: [number, number, number] = [
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
        newCentroids.push(avg);
      } else {
        newCentroids.push(centroids[j]);
      }
    }

    centroids = newCentroids;
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
    .map((x) => x.toString(16).padStart(2, "0"))
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

function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function getColorName(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);

  if (s < 10) return l > 50 ? "White" : "Black";
  if (l > 75) return "Light Gray";
  if (l < 25) return "Dark Gray";

  if (h >= 0 && h < 30) return "Red";
  if (h >= 30 && h < 60) return "Orange";
  if (h >= 60 && h < 90) return "Yellow";
  if (h >= 90 && h < 150) return "Green";
  if (h >= 150 && h < 210) return "Cyan";
  if (h >= 210 && h < 270) return "Blue";
  if (h >= 270 && h < 300) return "Purple";
  if (h >= 300 && h < 360) return "Magenta";

  return "Unknown";
}
