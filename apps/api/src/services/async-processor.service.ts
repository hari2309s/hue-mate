import { logger, TimeoutError, ImageProcessingError, NotFoundError } from '@hue-und-you/utils';
import { config } from '@hue-und-you/config';
import type { ColorPaletteResult, ProcessingOptions } from '@hue-und-you/types';
import { jobQueue, imageStorage } from '@/services';
import { extractColorsFromImage } from '@hue-und-you/color-engine';

class AsyncProcessorService {
  private activeTimeouts = new Map<string, NodeJS.Timeout>();

  async processImageAsync(imageId: string, options: ProcessingOptions = {}): Promise<void> {
    const logContext = { imageId, operation: 'async_processing' };

    const timeout = setTimeout(() => {
      logger.error(new TimeoutError('image processing', config.app.processingTimeoutMs), {
        ...logContext,
        timeoutMs: config.app.processingTimeoutMs,
      });

      jobQueue.update(imageId, {
        status: 'error',
        progress: 0,
        message: 'Processing timeout after 5 minutes',
      });

      this.activeTimeouts.delete(imageId);
    }, config.app.processingTimeoutMs);

    this.activeTimeouts.set(imageId, timeout);

    try {
      const image = await imageStorage.get(imageId);

      if (!image) {
        throw new NotFoundError('Image', imageId);
      }

      if (!Buffer.isBuffer(image.buffer) || image.buffer.length === 0) {
        throw new ImageProcessingError('Invalid image buffer', {
          imageId,
          bufferLength: image.buffer.length,
        });
      }

      logger.info('Starting color extraction', {
        imageId,
        filename: image.filename,
        options,
      });

      jobQueue.update(imageId, {
        status: 'segmenting',
        progress: 30,
        message: 'Segmenting image...',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      jobQueue.update(imageId, {
        status: 'extracting',
        progress: 60,
        message: 'Extracting colors...',
      });

      const result: ColorPaletteResult = await extractColorsFromImage(
        image.buffer,
        image.filename,
        {
          numColors: options.numColors,
          includeBackground: options.includeBackground ?? true,
          generateHarmonies: options.generateHarmonies ?? true,
        }
      );

      if (!result || !result.palette || result.palette.length === 0) {
        throw new ImageProcessingError('No colors extracted from image', {
          imageId,
          filename: image.filename,
        });
      }

      jobQueue.update(imageId, {
        status: 'complete',
        progress: 100,
        message: 'Color extraction complete',
        result,
      });

      logger.success('Color extraction completed', {
        imageId,
        colorsExtracted: result.palette.length,
        processingTimeMs: result.metadata.processingTimeMs,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error(err, {
        ...logContext,
        errorType: err.constructor.name,
      });

      let userMessage = 'Processing failed';

      if (error instanceof NotFoundError) {
        userMessage = 'Image not found';
      } else if (error instanceof ImageProcessingError) {
        userMessage = error.message;
      } else if (error instanceof TimeoutError) {
        userMessage = 'Processing took too long';
      } else if (err.message.includes('sharp')) {
        userMessage = 'Failed to process image format';
      } else if (err.message.includes('ENOENT')) {
        userMessage = 'Image file not found';
      }

      jobQueue.update(imageId, {
        status: 'error',
        progress: 0,
        message: userMessage,
      });
    } finally {
      const existingTimeout = this.activeTimeouts.get(imageId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.activeTimeouts.delete(imageId);
      }
    }
  }

  cancelProcessing(imageId: string): void {
    const timeout = this.activeTimeouts.get(imageId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(imageId);
      logger.info('Processing cancelled', { imageId });

      jobQueue.update(imageId, {
        status: 'error',
        progress: 0,
        message: 'Processing cancelled',
      });
    }
  }

  getActiveProcessingIds(): string[] {
    return Array.from(this.activeTimeouts.keys());
  }

  isProcessing(imageId: string): boolean {
    return this.activeTimeouts.has(imageId);
  }
}

export const asyncProcessor = new AsyncProcessorService();
