import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { randomUUID } from 'crypto';
import {
  router,
  publicProcedure,
  uploadImageSchema,
  processImageSchema,
  getResultSchema,
} from '@hue-und-you/api-schema';
import { extractColorsFromImage } from './services/colorExtraction';
import type { ColorPaletteResult, UploadStatus } from '@hue-und-you/types';

// In-memory storage (replace with DB in production)
const imageStore = new Map<string, { buffer: Buffer; filename: string; contentType: string }>();
const jobStore = new Map<
  string,
  {
    status: UploadStatus;
    progress: number;
    message: string;
    result?: ColorPaletteResult;
  }
>();

// tRPC Router with full implementations
const appRouter = router({
  health: publicProcedure.query(() => ({ status: 'ok' })),

  uploadImage: publicProcedure.input(uploadImageSchema).mutation(async ({ input }) => {
    const imageId = randomUUID();
    const buffer = Buffer.from(input.base64Data, 'base64');

    imageStore.set(imageId, {
      buffer,
      filename: input.filename,
      contentType: input.contentType,
    });

    jobStore.set(imageId, {
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
    const image = imageStore.get(input.imageId);
    if (!image) {
      throw new Error('Image not found');
    }

    // Update status
    jobStore.set(input.imageId, {
      status: 'processing',
      progress: 10,
      message: 'Starting color extraction...',
    });

    // Process asynchronously
    (async () => {
      try {
        jobStore.set(input.imageId, {
          status: 'segmenting',
          progress: 30,
          message: 'Segmenting image...',
        });

        await new Promise((r) => setTimeout(r, 500));

        jobStore.set(input.imageId, {
          status: 'extracting',
          progress: 60,
          message: 'Extracting colors...',
        });

        const result = await extractColorsFromImage(image.buffer, image.filename, input.options);

        jobStore.set(input.imageId, {
          status: 'complete',
          progress: 100,
          message: 'Color extraction complete',
          result,
        });
      } catch (error) {
        jobStore.set(input.imageId, {
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
    const job = jobStore.get(input.imageId);
    if (!job) {
      return { status: 'idle' as UploadStatus, progress: 0, message: 'Job not found' };
    }
    return { status: job.status, progress: job.progress, message: job.message };
  }),

  getResult: publicProcedure.input(getResultSchema).query(({ input }) => {
    const job = jobStore.get(input.imageId);
    if (!job || job.status !== 'complete') {
      return null;
    }
    return job.result ?? null;
  }),
});

export type AppRouter = typeof appRouter;

// Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Log environment variables on startup
console.log('🔧 Environment check:');
console.log('   PORT:', PORT);
console.log('   HF_API_KEY:', process.env.HUGGINGFACE_API_KEY ? '✓ Set' : '✗ Missing');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '✗ Missing');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/trpc', createExpressMiddleware({ router: appRouter }));

app.listen(PORT, () => {
  console.log(`\n🚀 API server running on http://localhost:${PORT}`);
});
