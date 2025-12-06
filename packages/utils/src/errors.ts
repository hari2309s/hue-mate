/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      ...(process.env.NODE_ENV !== 'production' && { stack: this.stack }),
    };
  }
}

/**
 * Validation error for invalid inputs
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, true, context);
  }
}

/**
 * Image processing errors
 */
export class ImageProcessingError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'IMAGE_PROCESSING_ERROR', 422, true, context);
  }
}

/**
 * Segmentation errors
 */
export class SegmentationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'SEGMENTATION_ERROR', 500, true, context);
  }
}

/**
 * Clustering errors
 */
export class ClusteringError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CLUSTERING_ERROR', 500, true, context);
  }
}

/**
 * External API errors (HuggingFace, etc.)
 */
export class ExternalAPIError extends AppError {
  constructor(
    message: string,
    public readonly service: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'EXTERNAL_API_ERROR', 502, true, { ...context, service });
  }
}

/**
 * Storage errors
 */
export class StorageError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', 500, true, context);
  }
}

/**
 * Resource not found errors
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    super(`${resource} not found${identifier ? `: ${identifier}` : ''}`, 'NOT_FOUND', 404, true, {
      resource,
      identifier,
    });
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends AppError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation timed out: ${operation}`, 'TIMEOUT_ERROR', 408, true, {
      operation,
      timeoutMs,
    });
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 'RATE_LIMIT_ERROR', 429, true);
  }
}

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Extract user-friendly error message
 */
export function getUserMessage(error: Error): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error.name === 'ZodError') {
    return 'Invalid input provided';
  }

  if (error.message.includes('ECONNREFUSED')) {
    return 'Service temporarily unavailable';
  }

  if (error.message.includes('ENOENT')) {
    return 'Resource not found';
  }

  return process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message;
}

/**
 * Retry logic for transient failures
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    backoff?: boolean;
    retryIf?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoff = true, retryIf = () => true } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!retryIf(lastError)) {
        throw lastError;
      }

      if (attempt === maxAttempts) {
        throw lastError;
      }

      const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
