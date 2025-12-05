import { Router, Request, Response } from 'express';
import { imageStorage, jobQueue } from '../../services';
import { extractColorsFromImage } from '../../core/color/extraction/pipeline';
import { logger, TimeoutError, ImageProcessingError } from '../../utils';
import { config } from '../../config';

const router = Router();

router.get('/:imageId', async (req: Request, res: Response) => {
  const { imageId } = req.params;
  const logContext = { imageId, operation: 'stream_processing' };

  logger.info('Stream request started', logContext);

  try {
    const image = await imageStorage.get(imageId);

    if (!image) {
      logger.warn('Stream requested for non-existent image', logContext);
      res.status(404).json({
        error: 'Image not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Validate image buffer
    if (!Buffer.isBuffer(image.buffer) || image.buffer.length === 0) {
      logger.warn('Invalid image buffer', logContext);
      res.status(422).json({
        error: 'Invalid image data',
        code: 'INVALID_IMAGE',
      });
      return;
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    let streamTimedOut = false;

    // Set timeout for stream
    const streamTimeout = setTimeout(() => {
      streamTimedOut = true;
      logger.warn('Stream timeout', logContext);

      if (!res.headersSent) {
        res.status(504).json({
          error: 'Stream timeout',
          code: 'TIMEOUT',
        });
      } else {
        try {
          res.write(
            JSON.stringify({
              status: 'error',
              message: 'Stream timeout after 5 minutes',
              code: 'TIMEOUT',
            }) + '\n'
          );
          res.end();
        } catch (writeError) {
          logger.error(writeError instanceof Error ? writeError : new Error(String(writeError)), {
            ...logContext,
            context: 'stream_timeout_write',
          });
        }
      }
    }, config.app.processingTimeoutMs);

    try {
      // Parse query parameters
      const parsedNumColors =
        typeof req.query.numColors === 'string' ? Number(req.query.numColors) : undefined;
      const includeBackground =
        typeof req.query.includeBackground === 'string'
          ? req.query.includeBackground !== 'false'
          : true;
      const generateHarmonies =
        typeof req.query.generateHarmonies === 'string'
          ? req.query.generateHarmonies !== 'false'
          : true;

      // Validate numColors if provided
      if (
        parsedNumColors !== undefined &&
        (!Number.isFinite(parsedNumColors) || parsedNumColors < 3 || parsedNumColors > 20)
      ) {
        throw new ImageProcessingError('numColors must be between 3 and 20', {
          provided: parsedNumColors,
        });
      }

      // Use lock to prevent concurrent processing
      await jobQueue.withLock(imageId, async () => {
        if (streamTimedOut) {
          return;
        }

        logger.info('Stream processing started', {
          ...logContext,
          numColors: parsedNumColors,
          includeBackground,
          generateHarmonies,
        });

        const result = await extractColorsFromImage(
          image.buffer,
          image.filename,
          {
            numColors: Number.isFinite(parsedNumColors) ? parsedNumColors : undefined,
            includeBackground,
            generateHarmonies,
          },
          {
            onPartial: (colors) => {
              if (!res.headersSent && !streamTimedOut) {
                try {
                  res.write(JSON.stringify({ status: 'partial', colors }) + '\n');
                  logger.info('Partial result sent', {
                    ...logContext,
                    colorCount: colors.length,
                  });
                } catch (writeError) {
                  logger.error(
                    writeError instanceof Error ? writeError : new Error(String(writeError)),
                    {
                      ...logContext,
                      context: 'stream_partial_write',
                    }
                  );
                }
              }
            },
          }
        );

        if (!streamTimedOut) {
          try {
            res.write(JSON.stringify({ status: 'complete', result }) + '\n');
            logger.success('Stream completed', {
              ...logContext,
              colorsExtracted: result.palette.length,
            });
          } catch (writeError) {
            logger.error(writeError instanceof Error ? writeError : new Error(String(writeError)), {
              ...logContext,
              context: 'stream_complete_write',
            });
          }
        }
      });

      if (!streamTimedOut) {
        res.end();
      }
    } catch (processingError) {
      const err =
        processingError instanceof Error ? processingError : new Error(String(processingError));

      logger.error(err, {
        ...logContext,
        context: 'stream_processing_error',
      });

      let errorMessage = 'Processing failed';
      let errorCode = 'PROCESSING_ERROR';

      if (err instanceof ImageProcessingError) {
        errorMessage = err.message;
        errorCode = err.code;
      } else if (err instanceof TimeoutError) {
        errorMessage = 'Processing took too long';
        errorCode = 'TIMEOUT';
      } else if (err.message.includes('sharp')) {
        errorMessage = 'Failed to process image format';
        errorCode = 'INVALID_IMAGE';
      }

      if (!res.headersSent && !streamTimedOut) {
        res.status(500).json({
          status: 'error',
          message: errorMessage,
          code: errorCode,
        });
      } else if (!streamTimedOut) {
        try {
          res.write(
            JSON.stringify({
              status: 'error',
              message: errorMessage,
              code: errorCode,
            }) + '\n'
          );
          res.end();
        } catch (writeError) {
          logger.error(writeError instanceof Error ? writeError : new Error(String(writeError)), {
            ...logContext,
            context: 'stream_error_write',
          });
        }
      }
    } finally {
      clearTimeout(streamTimeout);
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    logger.error(err, {
      ...logContext,
      context: 'stream_route_error',
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: err.message || 'Internal server error',
        code: 'INTERNAL_ERROR',
      });
    }
  }
});

export default router;
