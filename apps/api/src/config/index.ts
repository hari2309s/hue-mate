/**
 * Centralized Configuration
 *
 * Single source of truth for all application configuration.
 * Environment variables are validated and typed here.
 *
 * Usage:
 *   import { config } from '@/config';
 *   const port = config.app.port;
 *   const hfToken = config.huggingface.token;
 */

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

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

// ============================================================================
// APPLICATION CONFIG
// ============================================================================

export const config = {
  /**
   * Application settings
   */
  app: {
    port: getEnvNumber('PORT', 3001),
    nodeEnv: getEnv('NODE_ENV', 'development'),
    isDevelopment: getEnv('NODE_ENV', 'development') === 'development',
    isProduction: getEnv('NODE_ENV', 'development') === 'production',
    corsOrigin: getEnv('CORS_ORIGIN', '*'),

    // Image processing limits
    maxImageSizeMB: 10,
    maxSamples: 5000,
    partialColorCount: 5,

    // Timeouts
    processingTimeoutMs: 5 * 60 * 1000, // 5 minutes
    tempFileCleanupMs: 24 * 60 * 60 * 1000, // 24 hours
    cleanupIntervalMs: 60 * 60 * 1000, // 1 hour
  },

  /**
   * Hugging Face API configuration
   */
  huggingface: {
    apiUrl: 'https://router.huggingface.co/hf-inference/models',
    token: getEnv('HUGGINGFACE_API_KEY'),

    models: {
      mask2former: 'facebook/mask2former-swin-base-coco-panoptic',
      segformer: 'nvidia/segformer-b0-finetuned-ade-512-512',
    },

    retryDelayMs: 20000,
    requestTimeoutMs: 60000,
  },

  /**
   * Color extraction settings
   */
  extraction: {
    /**
     * Saturation bias - boost colorful pixels in sampling
     */
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

    /**
     * Clustering settings
     */
    clustering: {
      maxIterations: 100,
      convergenceEpsilon: 0.0001,
      deduplicationThreshold: 0.5,
      minHueDifference: 35,
      perceptualDistanceThreshold: 0.35,
    },

    /**
     * Brightness filtering
     */
    brightness: {
      min: 15,
      max: 240,
    },
  },

  /**
   * Rate limiting
   */
  rateLimit: {
    upload: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10,
    },
    process: {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 50,
    },
  },

  /**
   * Database (PostgreSQL)
   */
  database: {
    url: getEnv('DATABASE_URL'),
  },

  /**
   * Logging
   */
  logging: {
    level: getEnv('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error',
  },
} as const;

// ============================================================================
// TYPE EXPORTS (for strict typing)
// ============================================================================

export type Config = typeof config;
export type AppConfig = typeof config.app;
export type HuggingFaceConfig = typeof config.huggingface;
export type ExtractionConfig = typeof config.extraction;
export type RateLimitConfig = typeof config.rateLimit;

// ============================================================================
// LEGACY EXPORTS (backwards compatibility)
// ============================================================================

/**
 * @deprecated Use `config.app` instead
 */
export const APP_CONFIG = config.app;

/**
 * @deprecated Use `config.huggingface` instead
 */
export const HF_CONFIG = config.huggingface;

/**
 * @deprecated Use `config.extraction.saturation` instead
 */
export const SATURATION_CONFIG = config.extraction.saturation;

/**
 * @deprecated Use `config.extraction.clustering` instead
 */
export const CLUSTERING_CONFIG = config.extraction.clustering;

/**
 * @deprecated Use `config.extraction.brightness` instead
 */
export const BRIGHTNESS_CONFIG = config.extraction.brightness;

/**
 * @deprecated Use `config.rateLimit` instead
 */
export const RATE_LIMIT_CONFIG = config.rateLimit;

// ============================================================================
// VALIDATION ON STARTUP
// ============================================================================

/**
 * Validate configuration on application startup
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required environment variables
  if (!config.huggingface.token) {
    errors.push('HUGGINGFACE_API_KEY is not set - ML segmentation will be unavailable');
  }

  // Validate numeric ranges
  if (config.app.port < 1 || config.app.port > 65535) {
    errors.push(`Invalid PORT: ${config.app.port} (must be 1-65535)`);
  }

  if (config.app.maxImageSizeMB < 1 || config.app.maxImageSizeMB > 100) {
    errors.push(`Invalid maxImageSizeMB: ${config.app.maxImageSizeMB} (must be 1-100)`);
  }

  // Validate clustering settings
  if (config.extraction.clustering.maxIterations < 1) {
    errors.push('clustering.maxIterations must be at least 1');
  }

  if (config.extraction.clustering.convergenceEpsilon <= 0) {
    errors.push('clustering.convergenceEpsilon must be positive');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Print configuration summary (useful for debugging)
 */
export function printConfigSummary(): void {
  console.log('\n📋 Configuration Summary:');
  console.log('========================');
  console.log(`Environment: ${config.app.nodeEnv}`);
  console.log(`Port: ${config.app.port}`);
  console.log(`Max Image Size: ${config.app.maxImageSizeMB}MB`);
  console.log(`HuggingFace API: ${config.huggingface.token ? '✓ Configured' : '✗ Missing'}`);
  console.log(`Database: ${config.database.url ? '✓ Configured' : '✗ Missing'}`);
  console.log(`Log Level: ${config.logging.level}`);
  console.log('========================\n');
}
