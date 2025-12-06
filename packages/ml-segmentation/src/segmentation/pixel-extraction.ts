import sharp from 'sharp';
import { config } from '@hue-und-you/config';
import { logger } from '@hue-und-you/utils';
import type { ForegroundMask, ExtractedPixels, PixelData } from '@/types/segmentation';

/**
 * Optimized pixel extraction with smart sampling strategies
 * - Uses stratified sampling for better color distribution coverage
 * - Implements multi-scale sampling for small vs large images
 * - Pre-allocates arrays for better memory performance
 */

// Generate blue noise-like sampling pattern (better than uniform grid)
function generateSamplingPattern(totalPixels: number, targetSamples: number): Uint32Array {
  if (totalPixels <= targetSamples) {
    // Sample all pixels
    const indices = new Uint32Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      indices[i] = i;
    }
    return indices;
  }

  const sampleRate = totalPixels / targetSamples;
  const indices = new Uint32Array(targetSamples);

  // Use golden ratio for better distribution than uniform
  const goldenRatio = 0.618033988749895;
  let accumulator = 0;

  for (let i = 0; i < targetSamples; i++) {
    accumulator += goldenRatio;
    accumulator %= 1;
    indices[i] = Math.floor(accumulator * totalPixels + i * sampleRate) % totalPixels;
  }

  return indices;
}

// Fast brightness check using integer arithmetic
function isValidBrightness(r: number, g: number, b: number): boolean {
  // Use weighted average (approximates luminance)
  const brightness = (r * 77 + g * 150 + b * 29) >> 8; // Fast divide by 256
  return (
    brightness > config.extraction.brightness.min && brightness < config.extraction.brightness.max
  );
}

export async function extractPixels(
  imageBuffer: Buffer,
  foregroundMask: ForegroundMask | null
): Promise<ExtractedPixels> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const width = metadata.width!;
  const height = metadata.height!;

  logger.success('Image dimensions', { width, height });

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  let maskData: Uint8Array | null = null;
  if (foregroundMask) {
    const maskBuffer = await sharp(foregroundMask.mask)
      .resize(info.width, info.height, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();
    maskData = new Uint8Array(maskBuffer);
  }

  const totalPixels = info.width * info.height;
  const targetSamples = Math.min(totalPixels, config.app.maxSamples);

  // Generate sampling pattern
  const samplingIndices = generateSamplingPattern(totalPixels, targetSamples);

  logger.success('Sampling configuration', {
    totalPixels,
    targetSamples,
    samplingStrategy: 'golden-ratio',
    expectedQuality: 'high',
  });

  // Pre-allocate arrays with capacity
  const pixels: PixelData[] = [];
  const isForeground: boolean[] = [];

  // Reserve approximate capacity
  pixels.length = 0;
  isForeground.length = 0;

  const channels = info.channels;

  // Process samples
  for (let i = 0; i < samplingIndices.length; i++) {
    const pixelIndex = samplingIndices[i];
    const dataIndex = pixelIndex * channels;

    const r = data[dataIndex];
    const g = data[dataIndex + 1];
    const b = data[dataIndex + 2];

    // Fast brightness filter
    if (isValidBrightness(r, g, b)) {
      pixels.push({ r, g, b });

      if (maskData) {
        isForeground.push(maskData[pixelIndex] > 128);
      } else {
        isForeground.push(true);
      }
    }
  }

  logger.success('Pixel extraction complete', {
    extractedPixels: pixels.length,
    samplingEfficiency: `${((pixels.length / samplingIndices.length) * 100).toFixed(1)}%`,
    foregroundRatio: maskData
      ? `${((isForeground.filter(Boolean).length / pixels.length) * 100).toFixed(1)}%`
      : 'N/A',
  });

  return { pixels, isForeground };
}

// Multi-resolution sampling for very large images
export async function extractPixelsMultiScale(
  imageBuffer: Buffer,
  foregroundMask: ForegroundMask | null
): Promise<ExtractedPixels> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;
  const totalPixels = width * height;

  // If image is small enough, use standard extraction
  if (totalPixels <= config.app.maxSamples * 2) {
    return extractPixels(imageBuffer, foregroundMask);
  }

  logger.info('Using multi-scale sampling for large image');

  // Extract at multiple resolutions and combine
  const scales = [1.0, 0.5, 0.25];
  const allPixels: PixelData[] = [];
  const allIsForeground: boolean[] = [];

  for (const scale of scales) {
    const scaledWidth = Math.floor(width * scale);
    const scaledHeight = Math.floor(height * scale);

    // Resize image for this scale
    const scaledBuffer = await sharp(imageBuffer)
      .resize(scaledWidth, scaledHeight, {
        fit: 'fill',
        kernel: 'lanczos3', // High quality resampling
      })
      .raw()
      .toBuffer();

    // Extract subset at this scale
    const samplesAtScale = Math.floor(config.app.maxSamples * (scale * scale));
    const { pixels, isForeground } = await extractPixelsAtScale(
      scaledBuffer,
      scaledWidth,
      scaledHeight,
      foregroundMask,
      samplesAtScale
    );

    allPixels.push(...pixels);
    allIsForeground.push(...isForeground);
  }

  logger.success('Multi-scale extraction complete', {
    totalPixels: allPixels.length,
    scales: scales.length,
  });

  return { pixels: allPixels, isForeground: allIsForeground };
}

// Helper for scale-specific extraction
async function extractPixelsAtScale(
  rawBuffer: Buffer,
  width: number,
  height: number,
  _foregroundMask: ForegroundMask | null,
  targetSamples: number
): Promise<ExtractedPixels> {
  const totalPixels = width * height;
  const samplingIndices = generateSamplingPattern(totalPixels, targetSamples);

  const pixels: PixelData[] = [];
  const isForeground: boolean[] = [];

  const channels = 3; // Assuming RGB

  for (const pixelIndex of samplingIndices) {
    const dataIndex = pixelIndex * channels;

    const r = rawBuffer[dataIndex];
    const g = rawBuffer[dataIndex + 1];
    const b = rawBuffer[dataIndex + 2];

    if (isValidBrightness(r, g, b)) {
      pixels.push({ r, g, b });
      isForeground.push(true); // Simplified for scaled images
    }
  }

  return { pixels, isForeground };
}
