export const APP_CONFIG = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MAX_IMAGE_SIZE_MB: 10,
  MAX_SAMPLES: 5000,
  PARTIAL_COLOR_COUNT: 5,
} as const;
