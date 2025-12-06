import 'dotenv/config';
import { createApp } from '@/app';
import { config, validateConfig, printConfigSummary } from '@hue-und-you/config';
import { logger } from '@hue-und-you/utils';
import { imageStorage } from '@/services';

async function startServer() {
  // Validate configuration
  const validation = validateConfig();

  if (!validation.valid) {
    logger.warn('Configuration validation warnings:');
    validation.errors.forEach((error: string) => logger.warn(`  - ${error}`));
  }

  // Print config summary in development
  if (config.app.isDevelopment) {
    printConfigSummary();
  }

  // Initialize storage
  try {
    await imageStorage.initialize();
    logger.success('Services initialized');
  } catch (err: unknown) {
    logger.error('Failed to initialize services', { error: err });
    process.exit(1);
  }

  // Log environment check
  logger.info('Environment configuration', {
    port: config.app.port,
    nodeEnv: config.app.nodeEnv,
    maxImageSizeMB: config.app.maxImageSizeMB,
    processingTimeoutMs: config.app.processingTimeoutMs,
    hfApiKeySet: !!config.huggingface.token,
    databaseUrlSet: !!config.database.url,
  });

  const app = createApp();

  app.listen(config.app.port, () => {
    logger.success('API server started', {
      url: `http://localhost:${config.app.port}`,
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

startServer().catch((err: unknown) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
