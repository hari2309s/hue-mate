import sharp from 'sharp';
import { APP_CONFIG, BRIGHTNESS_CONFIG } from '../../config';
import { logger } from '../../utils';
import type { ForegroundMask, ExtractedPixels, PixelData } from '../../types/segmentation';

export async function extractPixels(
  imageBuffer: Buffer,
  foregroundMask: ForegroundMask | null
): Promise<ExtractedPixels> {
  const pixels: PixelData[] = [];
  const isForeground: boolean[] = [];

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  logger.success('Image dimensions', {
    width: metadata.width,
    height: metadata.height,
  });

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  let maskData: Buffer | null = null;
  if (foregroundMask) {
    maskData = await sharp(foregroundMask.mask)
      .resize(info.width, info.height, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();
  }

  const totalPixels = info.width * info.height;

  // DETERMINISTIC sampling: always use the same rate and pattern
  const sampleRate = Math.max(1, Math.floor(totalPixels / APP_CONFIG.MAX_SAMPLES));

  logger.success('Sampling configuration', {
    totalPixels,
    maxSamples: APP_CONFIG.MAX_SAMPLES,
    sampleRate,
    deterministic: true,
  });

  // Sample pixels in a consistent pattern (every Nth pixel)
  for (let i = 0; i < data.length; i += sampleRate * info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const brightness = (r + g + b) / 3;

    // Apply consistent brightness filter
    if (
      brightness > BRIGHTNESS_CONFIG.MIN_BRIGHTNESS &&
      brightness < BRIGHTNESS_CONFIG.MAX_BRIGHTNESS
    ) {
      pixels.push({ r, g, b });

      if (maskData) {
        const maskIndex = Math.floor(i / info.channels);
        isForeground.push(maskData[maskIndex] > 128);
      } else {
        isForeground.push(true);
      }
    }
  }

  logger.success('Pixel extraction complete', {
    extractedPixels: pixels.length,
    sampling: 'deterministic',
  });

  return { pixels, isForeground };
}
