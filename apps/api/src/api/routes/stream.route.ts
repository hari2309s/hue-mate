import { Router } from 'express';
import { imageStorage, jobQueue } from '../../services';
import { extractColorsFromImage } from '../../core/color/extraction/pipeline';
import { logger } from '../../utils';
import { APP_CONFIG } from '../../config';

const router = Router();

router.get('/:imageId', async (req, res) => {
  const { imageId } = req.params;

  logger.info('Stream request started', { imageId });

  const image = await imageStorage.get(imageId);

  if (!image) {
    logger.warn('Stream requested for non-existent image', { imageId });
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  // Set headers for streaming
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Set timeout for stream
  const streamTimeout = setTimeout(() => {
    logger.warn('Stream timeout', { imageId });
    if (!res.headersSent) {
      res.status(504).json({ error: 'Stream timeout' });
    } else {
      res.write(
        JSON.stringify({
          status: 'error',
          message: 'Stream timeout after 5 minutes',
        }) + '\n'
      );
      res.end();
    }
  }, APP_CONFIG.PROCESSING_TIMEOUT_MS);

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

  try {
    // Use lock to prevent concurrent processing
    await jobQueue.withLock(imageId, async () => {
      logger.info('Stream processing started', {
        imageId,
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
            if (!res.headersSent) {
              res.write(JSON.stringify({ status: 'partial', colors }) + '\n');
              logger.info('Partial result sent', {
                imageId,
                colorCount: colors.length,
              });
            }
          },
        }
      );

      res.write(JSON.stringify({ status: 'complete', result }) + '\n');
      logger.success('Stream completed', {
        imageId,
        colorsExtracted: result.palette.length,
      });
    });

    res.end();
  } catch (error) {
    logger.error('Stream processing failed', {
      imageId,
      error: error instanceof Error ? error.message : String(error),
    });

    const errorMessage = error instanceof Error ? error.message : 'Processing failed';

    if (!res.headersSent) {
      res.status(500).json({
        status: 'error',
        message: errorMessage,
      });
    } else {
      res.write(
        JSON.stringify({
          status: 'error',
          message: errorMessage,
        }) + '\n'
      );
      res.end();
    }
  } finally {
    clearTimeout(streamTimeout);
  }
});

export default router;
