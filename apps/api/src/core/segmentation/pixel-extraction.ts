import sharp from 'sharp';
import { APP_CONFIG } from '../../config';
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

  logger.success(`Image dimensions: ${metadata.width}x${metadata.height}`);

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
  const sampleRate = Math.max(1, Math.floor(totalPixels / APP_CONFIG.MAX_SAMPLES));

  logger.success(`Sampling every ${sampleRate} pixel(s) from ${totalPixels} total`);

  for (let i = 0; i < data.length; i += sampleRate * info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const brightness = (r + g + b) / 3;
    if (brightness > 15 && brightness < 240) {
      pixels.push({ r, g, b });

      if (maskData) {
        const maskIndex = Math.floor(i / info.channels);
        isForeground.push(maskData[maskIndex] > 128);
      } else {
        isForeground.push(true);
      }
    }
  }

  return { pixels, isForeground };
}
