import { randomUUID } from 'crypto';
import { router, publicProcedure } from '@hue-und-you/api-schema';
import { imageStorage, jobQueue, asyncProcessor } from '../../services';
import { logger } from '../../utils';
import { uploadImageSchema, processImageSchema, getResultSchema } from '../validation/schemas';

export const appRouter = router({
  health: publicProcedure.query(() => {
    logger.info('Health check requested');
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  uploadImage: publicProcedure.input(uploadImageSchema).mutation(async ({ input }) => {
    const imageId = randomUUID();

    try {
      const buffer = Buffer.from(input.base64Data, 'base64');

      logger.info('Upload started', {
        imageId,
        filename: input.filename,
        contentType: input.contentType,
        size: buffer.length,
      });

      await imageStorage.set(imageId, {
        buffer,
        filename: input.filename,
        contentType: input.contentType,
      });

      jobQueue.set(imageId, {
        status: 'idle',
        progress: 0,
        message: 'Image uploaded successfully',
      });

      logger.success('Upload completed', {
        imageId,
        filename: input.filename,
      });

      return {
        success: true,
        imageId,
        message: 'Image uploaded successfully',
      };
    } catch (error) {
      logger.error('Upload failed', {
        imageId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new Error(error instanceof Error ? error.message : 'Failed to upload image');
    }
  }),

  processImage: publicProcedure.input(processImageSchema).mutation(async ({ input }) => {
    const image = await imageStorage.get(input.imageId);

    if (!image) {
      logger.warn('Process requested for non-existent image', {
        imageId: input.imageId,
      });
      throw new Error('Image not found');
    }

    // Check if already processing
    if (jobQueue.isProcessing(input.imageId)) {
      logger.warn('Process already in progress', { imageId: input.imageId });
      return {
        success: false,
        status: 'processing' as const,
        message: 'Processing already in progress',
      };
    }

    jobQueue.update(input.imageId, {
      status: 'processing',
      progress: 10,
      message: 'Starting color extraction...',
    });

    logger.info('Processing started', {
      imageId: input.imageId,
      options: input.options,
    });

    // Start async processing with error boundary
    asyncProcessor.processImageAsync(input.imageId, input.options).catch((err: Error) => {
      logger.error('Unhandled async processing error', {
        imageId: input.imageId,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
    });

    return {
      success: true,
      status: 'processing' as const,
      message: 'Processing started',
    };
  }),

  getProcessingStatus: publicProcedure.input(getResultSchema).query(({ input }) => {
    const job = jobQueue.get(input.imageId);

    if (!job) {
      logger.warn('Status requested for non-existent job', {
        imageId: input.imageId,
      });
      return {
        status: 'idle' as const,
        progress: 0,
        message: 'Job not found',
      };
    }

    return {
      status: job.status,
      progress: job.progress,
      message: job.message,
    };
  }),

  getResult: publicProcedure.input(getResultSchema).query(({ input }) => {
    const job = jobQueue.get(input.imageId);

    if (!job || job.status !== 'complete') {
      logger.info('Result requested but not ready', {
        imageId: input.imageId,
        status: job?.status,
      });
      return null;
    }

    logger.info('Result retrieved', {
      imageId: input.imageId,
      colorsExtracted: job.result?.palette.length,
    });

    return job.result ?? null;
  }),
});

export type AppRouter = typeof appRouter;
