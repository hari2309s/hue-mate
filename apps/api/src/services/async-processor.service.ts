import type { ColorPaletteResult } from '@hue-und-you/types';
import { logger, TimeoutError, ImageProcessingError, NotFoundError } from '@/utils';
import { config } from '@/config';
import { jobQueue, imageStorage } from '@/services';
import { extractColorsFromImage } from '@/core/color/extraction/pipeline';

export interface ProcessingOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

class AsyncProcessorService {
  private activeTimeouts = new Map<string, NodeJS.Timeout>();

  async processImageAsync(imageId: string, options: ProcessingOptions = {}): Promise<void> {
    const logContext = { imageId, operation: 'async_processing' };

    // Set up timeout
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
      // Validate image exists
      const image = await imageStorage.get(imageId);

      if (!image) {
        throw new NotFoundError('Image', imageId);
      }

      // Validate image buffer
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

      // Update status to segmenting
      jobQueue.update(imageId, {
        status: 'segmenting',
        progress: 30,
        message: 'Segmenting image...',
      });

      // Small delay to ensure status update is visible
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update status to extracting
      jobQueue.update(imageId, {
        status: 'extracting',
        progress: 60,
        message: 'Extracting colors...',
      });

      // Perform extraction
      const result: ColorPaletteResult = await extractColorsFromImage(
        image.buffer,
        image.filename,
        {
          numColors: options.numColors,
          includeBackground: options.includeBackground ?? true,
          generateHarmonies: options.generateHarmonies ?? true,
        }
      );

      // Validate result
      if (!result || !result.palette || result.palette.length === 0) {
        throw new ImageProcessingError('No colors extracted from image', {
          imageId,
          filename: image.filename,
        });
      }

      // Update to complete
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
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      logger.error(err, {
        ...logContext,
        errorType: err.constructor.name,
      });

      // Determine user-friendly error message
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
      // Clear timeout
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

      // Update job status
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
