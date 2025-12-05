import sharp from 'sharp';
import { config } from '@/config';
import { logger } from '@/utils';
import { SegmentationError, ExternalAPIError, withRetry } from '@/utils/errors';
import type { ForegroundMask, SegmentResult } from '@/types/segmentation';
import { classifySegment } from './classification';

async function callHuggingFaceAPI(
  imageBuffer: Buffer,
  attempt: number = 1
): Promise<SegmentResult[]> {
  if (!config.huggingface.token) {
    throw new SegmentationError('HuggingFace API key not configured', {
      hint: 'Set HUGGINGFACE_API_KEY environment variable',
    });
  }

  try {
    logger.debug('Calling Mask2Former API', { attempt });

    const response = await fetch(
      `${config.huggingface.apiUrl}/${config.huggingface.models.mask2former}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.huggingface.token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(imageBuffer),
        signal: AbortSignal.timeout(60000), // 60s timeout
      }
    );

    if (!response.ok) {
      if (response.status === 503) {
        throw new ExternalAPIError('Model is loading, please retry', 'HuggingFace', {
          status: 503,
          shouldRetry: true,
        });
      }

      const errorText = await response.text().catch(() => 'Unknown error');
      throw new ExternalAPIError(`API request failed: ${response.status}`, 'HuggingFace', {
        status: response.status,
        error: errorText,
      });
    }

    const segments = (await response.json()) as SegmentResult[];

    if (!Array.isArray(segments)) {
      throw new SegmentationError('Invalid API response format', {
        receivedType: typeof segments,
      });
    }

    return segments;
  } catch (error) {
    if (error instanceof ExternalAPIError || error instanceof SegmentationError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ExternalAPIError('Network error connecting to HuggingFace', 'HuggingFace', {
        originalError: error.message,
      });
    }

    throw new SegmentationError('Unexpected error during API call', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function createMaskFromSegments(
  segments: SegmentResult[],
  width: number,
  height: number
): Promise<{ maskBuffer: Buffer; foregroundPercentage: number } | null> {
  if (segments.length === 0) {
    logger.warn('No segments to process');
    return null;
  }

  try {
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
        } catch (maskError) {
          logger.warn(`Failed to process mask for ${segment.label}`, {
            error: maskError instanceof Error ? maskError.message : String(maskError),
          });
          // Continue processing other segments
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
    const foregroundPercentage = (foregroundPixels / maskArray.length) * 100;

    const finalMaskBuffer = await sharp(Buffer.from(maskArray), {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();

    return {
      maskBuffer: finalMaskBuffer,
      foregroundPercentage,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(err, { operation: 'mask_creation' });
    throw new SegmentationError('Failed to create segmentation mask', {
      error: err.message,
    });
  }
}

export async function segmentForegroundBackground(
  imageBuffer: Buffer
): Promise<ForegroundMask | null> {
  try {
    logger.info('Starting foreground/background segmentation');

    // Validate input
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new SegmentationError('Invalid image buffer', {
        isBuffer: Buffer.isBuffer(imageBuffer),
        length: imageBuffer.length,
      });
    }

    // Get image dimensions
    const metadata = await sharp(imageBuffer)
      .metadata()
      .catch((error) => {
        throw new SegmentationError('Failed to read image metadata', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

    const { width, height } = metadata;
    if (!width || !height) {
      throw new SegmentationError('Could not determine image dimensions', { metadata });
    }

    // Call API with retry logic
    const segments = await withRetry(() => callHuggingFaceAPI(imageBuffer), {
      maxAttempts: 2,
      delayMs: config.huggingface.retryDelayMs,
      backoff: false,
      retryIf: (error) => {
        // Only retry on 503 (model loading)
        return error instanceof ExternalAPIError && error.context?.status === 503;
      },
    });

    logger.success(`Received ${segments.length} segments from Mask2Former`);

    // Create mask from segments
    const result = await createMaskFromSegments(segments, width, height);

    if (!result) {
      return null;
    }

    logger.success(`Foreground: ${result.foregroundPercentage.toFixed(1)}%`);
    logger.info(
      `Detected segments: ${segments.map((s) => `${s.label}(${s.score.toFixed(2)})`).join(', ')}`
    );

    return {
      mask: result.maskBuffer,
      foreground_percentage: result.foregroundPercentage,
    };
  } catch (error) {
    // Log but don't throw - allow fallback to continue
    logger.error(error instanceof Error ? error : new Error(String(error)), {
      operation: 'segmentation',
    });
    return null;
  }
}
