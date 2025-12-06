/**
 * Centralized application configuration.
 * Single source of truth for env validation and typed settings.
 */

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    console.warn(`⚠️  Environment variable ${key} is not set`);
    return '';
  }
  return value || defaultValue || '';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(
      `⚠️  Environment variable ${key} is not a valid number, using default: ${defaultValue}`
    );
    return defaultValue;
  }
  return parsed;
}

export const config = {
  app: {
    port: getEnvNumber('PORT', 3001),
    nodeEnv: getEnv('NODE_ENV', 'development'),
    isDevelopment: getEnv('NODE_ENV', 'development') === 'development',
    isProduction: getEnv('NODE_ENV', 'development') === 'production',
    corsOrigin: getEnv('CORS_ORIGIN', '*'),
    maxImageSizeMB: 10,
    maxSamples: 5000,
    partialColorCount: 5,
    processingTimeoutMs: 5 * 60 * 1000,
    tempFileCleanupMs: 24 * 60 * 60 * 1000,
    cleanupIntervalMs: 60 * 60 * 1000,
  },
  huggingface: {
    apiUrl: 'https://router.huggingface.co/hf-inference/models',
    token: getEnv('HUGGINGFACE_API_KEY'),
    models: {
      mask2former: 'facebook/mask2former-swin-base-coco-panoptic',
      segformer: 'nvidia/segformer-b0-finetuned-ade-512-512',
    },
    retryDelayMs: 20000,
    requestTimeoutMs: 60000, // Default timeout (fallback)
    modelTimeouts: {
      mask2former: getEnvNumber('HF_MASK2FORMER_TIMEOUT_MS', 120000), // 120s for Mask2Former (slower model)
      segformer: getEnvNumber('HF_SEGFORMER_TIMEOUT_MS', 60000), // 60s for SegFormer (faster model)
    },
  },
  extraction: {
    saturation: {
      highThreshold: 75,
      mediumThreshold: 50,
      lowThreshold: 25,
      highBoost: 12,
      mediumBoost: 7,
      lowBoost: 2.5,
      neutralBoost: 0.3,
      lightnessBoost: 1.8,
      optimalLightnessMin: 20,
      optimalLightnessMax: 80,
      highPower: 1.5,
      mediumPower: 1.6,
      lowPower: 1.3,
    },
    clustering: {
      maxIterations: 100,
      convergenceEpsilon: 0.0001,
      deduplicationThreshold: 0.5,
      minHueDifference: 35,
      perceptualDistanceThreshold: 0.35,
    },
    brightness: {
      min: 15,
      max: 240,
    },
  },
  rateLimit: {
    upload: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
    },
    process: {
      windowMs: 1 * 60 * 1000,
      maxRequests: 50,
    },
  },
  database: {
    url: getEnv('DATABASE_URL'),
  },
  logging: {
    level: getEnv('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
  },
  performance: {
    // Enable conversion caching (default: true)
    enableConversionCache: true,

    // Cache sizes
    oklabCacheSize: 2000,
    hslCacheSize: 2000,
    oklchCacheSize: 1000,

    // Pixel sampling strategy
    pixelSamplingStrategy: 'golden-ratio' as const,

    // Enable multi-scale for large images (default: true)
    enableMultiScale: true,
    multiScaleThreshold: 10000000, // 10M pixels

    // K-means optimization
    kmeansEarlyStop: true,
    kmeansChangeThreshold: 0.001,

    // Spatial indexing
    spatialHashGridSize: 10,
  },
} as const;

export type Config = typeof config;
export type AppConfig = typeof config.app;
export type HuggingFaceConfig = typeof config.huggingface;
export type ExtractionConfig = typeof config.extraction;
export type RateLimitConfig = typeof config.rateLimit;
export type PerformanceConfig = typeof config.performance;

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.huggingface.token) {
    errors.push('HUGGINGFACE_API_KEY is not set - ML segmentation will be unavailable');
  }

  if (config.app.port < 1 || config.app.port > 65535) {
    errors.push(`Invalid PORT: ${config.app.port} (must be 1-65535)`);
  }

  if (config.app.maxImageSizeMB < 1 || config.app.maxImageSizeMB > 100) {
    errors.push(`Invalid maxImageSizeMB: ${config.app.maxImageSizeMB} (must be 1-100)`);
  }

  if (config.extraction.clustering.maxIterations < 1) {
    errors.push('clustering.maxIterations must be at least 1');
  }

  if (config.extraction.clustering.convergenceEpsilon <= 0) {
    errors.push('clustering.convergenceEpsilon must be positive');
  }

  // Validate timeout values
  if (config.huggingface.modelTimeouts.mask2former < 1000) {
    errors.push('HF_MASK2FORMER_TIMEOUT_MS must be at least 1000ms');
  }
  if (config.huggingface.modelTimeouts.segformer < 1000) {
    errors.push('HF_SEGFORMER_TIMEOUT_MS must be at least 1000ms');
  }
  if (config.huggingface.requestTimeoutMs < 1000) {
    errors.push('requestTimeoutMs must be at least 1000ms');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function printConfigSummary(): void {
  console.log('\n📋 Configuration Summary:');
  console.log('========================');
  console.log(`Environment: ${config.app.nodeEnv}`);
  console.log(`Port: ${config.app.port}`);
  console.log(`Max Image Size: ${config.app.maxImageSizeMB}MB`);
  console.log(`HuggingFace API: ${config.huggingface.token ? '✓ Configured' : '✗ Missing'}`);
  if (config.huggingface.token) {
    console.log(`  Mask2Former Timeout: ${config.huggingface.modelTimeouts.mask2former / 1000}s`);
    console.log(`  SegFormer Timeout: ${config.huggingface.modelTimeouts.segformer / 1000}s`);
    console.log(`  Default Timeout: ${config.huggingface.requestTimeoutMs / 1000}s`);
  }
  console.log(`Database: ${config.database.url ? '✓ Configured' : '✗ Missing'}`);
  console.log(`Log Level: ${config.logging.level}`);
  console.log('========================\n');
}
