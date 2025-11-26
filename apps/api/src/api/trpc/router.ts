import { randomUUID } from 'crypto';
import {
  router,
  publicProcedure,
  uploadImageSchema,
  processImageSchema,
  getResultSchema,
} from '@hue-und-you/api-schema';
import { imageStorage, jobQueue } from '../../services';
import { extractColorsFromImage } from '../../core/color/extraction/pipeline';

export const appRouter = router({
  health: publicProcedure.query(() => ({ status: 'ok' })),

  uploadImage: publicProcedure.input(uploadImageSchema).mutation(async ({ input }) => {
    const imageId = randomUUID();
    const buffer = Buffer.from(input.base64Data, 'base64');

    imageStorage.set(imageId, {
      buffer,
      filename: input.filename,
      contentType: input.contentType,
    });

    jobQueue.set(imageId, {
      status: 'idle',
      progress: 0,
      message: 'Image uploaded successfully',
    });

    return {
      success: true,
      imageId,
      message: 'Image uploaded successfully',
    };
  }),

  processImage: publicProcedure.input(processImageSchema).mutation(async ({ input }) => {
    const image = imageStorage.get(input.imageId);
    if (!image) {
      throw new Error('Image not found');
    }

    jobQueue.update(input.imageId, {
      status: 'processing',
      progress: 10,
      message: 'Starting color extraction...',
    });

    // Process asynchronously
    (async () => {
      try {
        jobQueue.update(input.imageId, {
          status: 'segmenting',
          progress: 30,
          message: 'Segmenting image...',
        });

        await new Promise((r) => setTimeout(r, 500));

        jobQueue.update(input.imageId, {
          status: 'extracting',
          progress: 60,
          message: 'Extracting colors...',
        });

        const result = await extractColorsFromImage(image.buffer, image.filename, input.options);

        jobQueue.update(input.imageId, {
          status: 'complete',
          progress: 100,
          message: 'Color extraction complete',
          result,
        });
      } catch (error) {
        jobQueue.update(input.imageId, {
          status: 'error',
          progress: 0,
          message: error instanceof Error ? error.message : 'Processing failed',
        });
      }
    })();

    return {
      success: true,
      status: 'processing' as const,
      message: 'Processing started',
    };
  }),

  getProcessingStatus: publicProcedure.input(getResultSchema).query(({ input }) => {
    const job = jobQueue.get(input.imageId);
    if (!job) {
      return { status: 'idle' as const, progress: 0, message: 'Job not found' };
    }
    return { status: job.status, progress: job.progress, message: job.message };
  }),

  getResult: publicProcedure.input(getResultSchema).query(({ input }) => {
    const job = jobQueue.get(input.imageId);
    if (!job || job.status !== 'complete') {
      return null;
    }
    return job.result ?? null;
  }),
});

export type AppRouter = typeof appRouter;
