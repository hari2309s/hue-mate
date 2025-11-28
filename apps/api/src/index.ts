import 'dotenv/config';
import { createApp } from './app';
import { APP_CONFIG, HF_CONFIG } from './config';
import { logger } from './utils';
import { imageStorage } from './services';

async function startServer() {
  // Initialize storage
  try {
    await imageStorage.initialize();
    logger.success('Services initialized');
  } catch (err) {
    logger.error('Failed to initialize services', { error: err });
    process.exit(1);
  }

  // Log environment check
  logger.info('Environment configuration', {
    port: APP_CONFIG.PORT,
    nodeEnv: APP_CONFIG.NODE_ENV,
    maxImageSizeMB: APP_CONFIG.MAX_IMAGE_SIZE_MB,
    processingTimeoutMs: APP_CONFIG.PROCESSING_TIMEOUT_MS,
    hfApiKeySet: !!HF_CONFIG.TOKEN,
    databaseUrlSet: !!process.env.DATABASE_URL,
  });

  const app = createApp();

  app.listen(APP_CONFIG.PORT, () => {
    logger.success('API server started', {
      url: `http://localhost:${APP_CONFIG.PORT}`,
      endpoints: {
        health: '/health',
        trpc: '/trpc',
        stream: '/stream/:imageId',
      },
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', {
      reason: String(reason),
      promise: String(promise),
    });
    process.exit(1);
  });
}

startServer().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
