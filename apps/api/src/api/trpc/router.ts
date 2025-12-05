import { randomUUID } from 'crypto';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '@hue-und-you/api-schema';
import { imageStorage, jobQueue, asyncProcessor } from '@/services';
import { logger, NotFoundError, ValidationError, StorageError } from '@/utils';
import { uploadImageSchema, processImageSchema, getResultSchema } from '@/api/validation/schemas';

export const appRouter = router({
  health: publicProcedure.query(() => {
    logger.info('Health check requested');
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  uploadImage: publicProcedure.input(uploadImageSchema).mutation(async ({ input }) => {
    const imageId = randomUUID();

    try {
      // Validate input
      if (!input.base64Data || input.base64Data.length === 0) {
        throw new ValidationError('Image data is required');
      }

      const buffer = Buffer.from(input.base64Data, 'base64');

      // Validate buffer
      if (buffer.length === 0) {
        throw new ValidationError('Invalid or empty image data');
      }

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
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        context: 'upload_image',
        imageId,
      });

      if (error instanceof ValidationError) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message,
          cause: error,
        });
      }

      if (error instanceof StorageError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to store image',
          cause: error,
        });
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to upload image',
        cause: error,
      });
    }
  }),

  processImage: publicProcedure.input(processImageSchema).mutation(async ({ input }) => {
    try {
      const image = await imageStorage.get(input.imageId);

      if (!image) {
        logger.warn('Process requested for non-existent image', {
          imageId: input.imageId,
        });
        throw new NotFoundError('Image', input.imageId);
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
      asyncProcessor.processImageAsync(input.imageId, input.options || {}).catch((err: Error) => {
        logger.error(err, {
          context: 'async_processing',
          imageId: input.imageId,
        });
      });

      return {
        success: true,
        status: 'processing' as const,
        message: 'Processing started',
      };
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        context: 'process_image',
        imageId: input.imageId,
      });

      if (error instanceof NotFoundError) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: error.message,
          cause: error,
        });
      }

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to process image',
        cause: error,
      });
    }
  }),

  getProcessingStatus: publicProcedure.input(getResultSchema).query(({ input }) => {
    try {
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
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        context: 'get_status',
        imageId: input.imageId,
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get processing status',
        cause: error,
      });
    }
  }),

  getResult: publicProcedure.input(getResultSchema).query(({ input }) => {
    try {
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
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        context: 'get_result',
        imageId: input.imageId,
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to retrieve result',
        cause: error,
      });
    }
  }),
});

export type AppRouter = typeof appRouter;
