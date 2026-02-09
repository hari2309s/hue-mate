import sharp from 'sharp';
import { config } from '@/config';
import { SegmentationError, ExternalAPIError, withRetry, logger } from '@hute-mate/utils';
import type { ForegroundMask, SegmentResult } from '@hute-mate/types';
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
    logger.debug('Calling Mask2Former API', {
      attempt,
      imageSize: imageBuffer.length,
    });

    const timeoutMs =
      config.huggingface.modelTimeouts?.mask2former || config.huggingface.requestTimeoutMs;

    const response = await fetch(
      `${config.huggingface.apiUrl}/${config.huggingface.models.mask2former}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.huggingface.token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(imageBuffer),
        signal: AbortSignal.timeout(timeoutMs),
      }
    );

    logger.debug('Received response from Mask2Former API', {
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      if (response.status === 503) {
        throw new ExternalAPIError('Model is loading, please retry', 'HuggingFace', {
          status: 503,
          shouldRetry: true,
        });
      }

      const errorText = await response.text().catch(() => 'Unknown error');
      logger.warn('HuggingFace API returned error status', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
      });
      throw new ExternalAPIError(`API request failed: ${response.status}`, 'HuggingFace', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500),
      });
    }

    const segments = (await response.json()) as SegmentResult[];

    logger.debug('Parsed segments from API response', {
      segmentCount: Array.isArray(segments) ? segments.length : 0,
    });

    if (!Array.isArray(segments)) {
      logger.error('Invalid API response format', {
        receivedType: typeof segments,
        receivedValue: JSON.stringify(segments).substring(0, 200),
      });
      throw new SegmentationError('Invalid API response format', {
        receivedType: typeof segments,
        receivedValue: JSON.stringify(segments).substring(0, 200),
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

    const errorDetails: Record<string, unknown> = {
      error: error instanceof Error ? error.message : String(error),
    };

    if (error instanceof Error) {
      errorDetails.name = error.name;
      errorDetails.stack = error.stack;
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorDetails.type = 'timeout';
        const timeoutMs =
          config.huggingface.modelTimeouts?.mask2former || config.huggingface.requestTimeoutMs;
        errorDetails.hint = `The request timed out after ${timeoutMs / 1000} seconds`;
        errorDetails.timeoutMs = timeoutMs;
      } else if (error.message.includes('fetch')) {
        errorDetails.type = 'network';
        errorDetails.hint = 'Network error connecting to HuggingFace API';
      } else if (error.message.includes('JSON')) {
        errorDetails.type = 'parse';
        errorDetails.hint = 'Failed to parse API response';
      }
    }

    throw new SegmentationError('Unexpected error during API call', errorDetails);
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

    // Process mask segments in parallel
    const segmentProcessingPromises = segments.map(async (segment) => {
      const classification = classifySegment(segment.label, segment.score, segments);

      if ((classification === 'foreground' || classification === 'uncertain') && segment.mask) {
        try {
          const maskBuffer = Buffer.from(segment.mask, 'base64');
          const { data: segmentMaskData } = await sharp(maskBuffer)
            .resize(width, height, { fit: 'fill' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

          return {
            success: true,
            data: segmentMaskData,
            label: segment.label,
            score: segment.score,
            classification,
          };
        } catch (maskError) {
          logger.warn(`Failed to process mask for ${segment.label}`, {
            error: maskError instanceof Error ? maskError.message : String(maskError),
          });
          return { success: false };
        }
      }
      return { success: false };
    });

    const processedSegments = await Promise.all(segmentProcessingPromises);

    // Combine all processed masks into single array
    for (const result of processedSegments) {
      if (result.success && result.data) {
        for (let i = 0; i < maskArray.length && i < result.data.length; i++) {
          if (result.data[i] > 128) {
            maskArray[i] = 255;
          }
        }
        foregroundSegmentCount++;
        logger.success(
          `Added ${result.classification} segment: ${result.label} (score: ${result.score!.toFixed(2)})`
        );
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

    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new SegmentationError('Invalid image buffer', {
        isBuffer: Buffer.isBuffer(imageBuffer),
        length: imageBuffer.length,
      });
    }

    // Parallel metadata fetch and image resize
    const [metadata, resizedBuffer] = await Promise.all([
      sharp(imageBuffer)
        .metadata()
        .catch((error) => {
          throw new SegmentationError('Failed to read image metadata', {
            error: error instanceof Error ? error.message : String(error),
          });
        }),
      sharp(imageBuffer)
        .png()
        .toBuffer()
        .catch((error) => {
          throw new SegmentationError('Failed to resize image', {
            error: error instanceof Error ? error.message : String(error),
          });
        }),
    ]);

    const { width, height } = metadata;
    if (!width || !height) {
      throw new SegmentationError('Could not determine image dimensions', { metadata });
    }

    logger.info(
      `Image dimensions: ${width}x${height}, resized buffer: ${resizedBuffer.length} bytes`
    );

    // Call API with retry logic
    const segments = await withRetry(() => callHuggingFaceAPI(resizedBuffer), {
      maxAttempts: 2,
      delayMs: config.huggingface.retryDelayMs,
      backoff: false,
      retryIf: (error) => {
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
    const errorDetails: Record<string, unknown> = {
      operation: 'segmentation',
      method: 'foreground-background',
    };

    if (error instanceof SegmentationError) {
      errorDetails.message = error.message;
      errorDetails.context = error.context;
      errorDetails.stack = error.stack;
    } else if (error instanceof ExternalAPIError) {
      errorDetails.message = error.message;
      errorDetails.service = error.service;
      errorDetails.context = error.context;
      errorDetails.stack = error.stack;
    } else if (error instanceof Error) {
      errorDetails.message = error.message;
      errorDetails.name = error.name;
      errorDetails.stack = error.stack;
    } else {
      errorDetails.error = String(error);
    }

    logger.error(error instanceof Error ? error : new Error(String(error)), errorDetails);
    return null;
  }
}
