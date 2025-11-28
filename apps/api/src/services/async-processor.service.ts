import type { ColorPaletteResult } from '@hue-und-you/types';
import { logger } from '../utils';
import { APP_CONFIG } from '../config';
import { jobQueue, imageStorage } from '../services';
import { extractColorsFromImage } from '../core/color/extraction/pipeline';

export interface ProcessingOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

class AsyncProcessorService {
  private activeTimeouts = new Map<string, NodeJS.Timeout>();

  async processImageAsync(imageId: string, options: ProcessingOptions = {}): Promise<void> {
    // Set up timeout
    const timeout = setTimeout(() => {
      logger.error('Processing timeout', {
        imageId,
        timeoutMs: APP_CONFIG.PROCESSING_TIMEOUT_MS,
      });

      jobQueue.update(imageId, {
        status: 'error',
        progress: 0,
        message: 'Processing timeout after 5 minutes',
      });

      this.activeTimeouts.delete(imageId);
    }, APP_CONFIG.PROCESSING_TIMEOUT_MS);

    this.activeTimeouts.set(imageId, timeout);

    try {
      const image = await imageStorage.get(imageId);

      if (!image) {
        throw new Error('Image not found in storage');
      }

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

      logger.info('Starting color extraction', {
        imageId,
        filename: image.filename,
        options,
      });

      // Perform extraction
      const result: ColorPaletteResult = await extractColorsFromImage(
        image.buffer,
        image.filename,
        options
      );

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
      logger.error('Processing failed', {
        imageId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      jobQueue.update(imageId, {
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Processing failed',
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
    }
  }

  getActiveProcessingIds(): string[] {
    return Array.from(this.activeTimeouts.keys());
  }
}

export const asyncProcessor = new AsyncProcessorService();
