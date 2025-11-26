import sharp from 'sharp';
import { HF_CONFIG } from '../../config';
import { logger } from '../../utils';
import type { ForegroundMask, SegmentResult } from '../../types/segmentation';
import { classifySegment } from './classification';

export async function segmentForegroundBackground(
  imageBuffer: Buffer
): Promise<ForegroundMask | null> {
  try {
    logger.info('Calling Mask2Former for foreground/background separation...');

    const response = await fetch(`${HF_CONFIG.API_URL}/${HF_CONFIG.MODELS.MASK2FORMER}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_CONFIG.TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(imageBuffer),
    });

    if (!response.ok) {
      if (response.status === 503) {
        logger.warn('Model loading, waiting 20 seconds...');
        await new Promise((r) => setTimeout(r, HF_CONFIG.RETRY_DELAY_MS));
        return segmentForegroundBackground(imageBuffer);
      }
      const errorText = await response.text();
      logger.error(`Mask2Former failed with status ${response.status}: ${errorText}`);
      return null;
    }

    const segments = (await response.json()) as SegmentResult[];

    if (!Array.isArray(segments) || segments.length === 0) {
      return null;
    }

    logger.success(`Received ${segments.length} segments from Mask2Former`);

    const { width, height } = await sharp(imageBuffer).metadata();
    if (!width || !height) {
      return null;
    }

    const maskArray = new Uint8Array(width * height);
    let foregroundSegmentCount = 0;

    for (const segment of segments) {
      const classification = classifySegment(segment.label, segment.score, segments);

      if ((classification === 'foreground' || classification === 'uncertain') && segment.mask) {
        try {
          const maskBuffer = Buffer.from(segment.mask, 'base64');
          const { data: segmentMaskData } = await sharp(maskBuffer)
            .resize(width, height, { fit: 'fill' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

          for (let i = 0; i < maskArray.length && i < segmentMaskData.length; i++) {
            if (segmentMaskData[i] > 128) {
              maskArray[i] = 255;
            }
          }

          foregroundSegmentCount++;
          logger.success(
            `Added ${classification} segment: ${segment.label} (score: ${segment.score.toFixed(2)})`
          );
        } catch {
          logger.warn(`Failed to process mask for ${segment.label}`);
        }
      }
    }

    if (foregroundSegmentCount === 0) {
      logger.warn('No foreground segments identified');
      return null;
    }

    let foregroundPixels = 0;
    for (let i = 0; i < maskArray.length; i++) {
      if (maskArray[i] > 128) foregroundPixels++;
    }
    const foreground_percentage = (foregroundPixels / maskArray.length) * 100;

    if (foreground_percentage > 95 && foreground_percentage <= 99.5) {
      logger.info(
        `Large foreground detected (${foreground_percentage.toFixed(1)}%) - may be close-up or portrait`
      );
    }

    const finalMaskBuffer = await sharp(Buffer.from(maskArray), {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();

    logger.success(`Foreground: ${foreground_percentage.toFixed(1)}%`);
    logger.info(
      `Detected segments: ${segments.map((s) => `${s.label}(${s.score.toFixed(2)})`).join(', ')}`
    );

    return { mask: finalMaskBuffer, foreground_percentage };
  } catch (error) {
    logger.error(`Mask2Former segmentation failed: ${error}`);
    return null;
  }
}
