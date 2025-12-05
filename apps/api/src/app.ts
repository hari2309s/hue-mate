import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { TRPCError } from '@trpc/server';
import { appRouter } from '@/api/trpc/router';
import streamRoute from '@/api/routes/stream.route';
import { logger } from '@/utils';
import { config } from '@hue-und-you/color-engine';
import { AppError, RateLimitError, getUserMessage, isOperationalError } from '@/utils/errors';

// Rate limiters
const uploadLimiter = rateLimit({
  windowMs: config.rateLimit.upload.windowMs,
  max: config.rateLimit.upload.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });

    const error = new RateLimitError('Too many upload requests, please try again later');
    res.status(error.statusCode).json(error.toJSON());
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

const processLimiter = rateLimit({
  windowMs: config.rateLimit.process.windowMs,
  max: config.rateLimit.process.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Process rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      imageId: req.params.imageId,
    });

    const error = new RateLimitError('Too many processing requests, please try again later');
    res.status(error.statusCode).json(error.toJSON());
  },
});

// Request ID middleware
function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

// Request logging middleware
function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      ip: req.ip,
      requestId: req.headers['x-request-id'],
    };

    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
}

// Convert AppError to tRPC error
function handleTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof AppError) {
    let code: TRPCError['code'] = 'INTERNAL_SERVER_ERROR';

    switch (error.statusCode) {
      case 400:
        code = 'BAD_REQUEST';
        break;
      case 401:
        code = 'UNAUTHORIZED';
        break;
      case 403:
        code = 'FORBIDDEN';
        break;
      case 404:
        code = 'NOT_FOUND';
        break;
      case 408:
        code = 'TIMEOUT';
        break;
      case 409:
        code = 'CONFLICT';
        break;
      case 422:
        code = 'UNPROCESSABLE_CONTENT';
        break;
      case 429:
        code = 'TOO_MANY_REQUESTS';
        break;
    }

    return new TRPCError({
      code,
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof Error) {
    logger.error(error, { context: 'trpc_error_handler' });
    return new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: getUserMessage(error),
      cause: error,
    });
  }

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}

export function createApp() {
  const app = express();

  // Trust proxy for rate limiting
  app.set('trust proxy', 1);

  // Global middleware
  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    })
  );

  // Body parser with size limit and error handling
  app.use(
    express.json({
      limit: '50mb',
      verify: (req, _res, buf, encoding) => {
        try {
          const enc = encoding as BufferEncoding | undefined;
          JSON.parse(buf.toString(enc || 'utf8'));
        } catch (e) {
          logger.warn('Invalid JSON in request body', {
            path: (req as any).path,
            error: e instanceof Error ? e.message : String(e),
          });
          throw new Error('Invalid JSON');
        }
      },
    })
  );

  // Handle JSON parsing errors
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      logger.warn('JSON parse error', {
        path: req.path,
        error: err.message,
      });
      res.status(400).json({
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON',
      });
      return;
    }
    next(err);
  });

  // Health check (no rate limit)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Stream route with rate limiting
  app.use('/stream', processLimiter, streamRoute);

  // tRPC with error handling
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: async ({ req, res }) => {
        // Apply rate limiting for upload operations
        if (req.url?.includes('uploadImage')) {
          return new Promise((resolve, reject) => {
            uploadLimiter(req as any, res as any, (err?: any) => {
              if (err) reject(err);
              else resolve({ req, res });
            });
          });
        }
        return { req, res };
      },
      onError: ({ error, path, input }) => {
        logger.error(error, {
          context: 'trpc_error',
          path,
          input: process.env.NODE_ENV === 'development' ? input : undefined,
        });

        // Convert to tRPC error if needed
        if (!(error instanceof TRPCError)) {
          handleTRPCError(error);
        }
      },
    })
  );

  // 404 handler
  app.use((req, res) => {
    logger.warn('Route not found', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    res.status(404).json({
      error: 'Route not found',
      path: req.path,
      code: 'NOT_FOUND',
    });
  });

  // Global error handler (must be last)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    // Don't send error if headers already sent
    if (res.headersSent) {
      next(err);
      return;
    }

    // Log error
    if (err instanceof AppError) {
      logger.error(err, {
        context: 'error_handler',
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId: req.headers['x-request-id'],
      });
    } else {
      logger.error(err instanceof Error ? err : new Error(String(err)), {
        context: 'error_handler',
        method: req.method,
        path: req.path,
        ip: req.ip,
        requestId: req.headers['x-request-id'],
      });
    }

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Build error response
    const errorResponse: any = {
      error: getUserMessage(err),
      code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
      requestId: req.headers['x-request-id'],
    };

    // Add stack trace in development for non-operational errors
    if (process.env.NODE_ENV !== 'production' && !isOperationalError(err)) {
      errorResponse.stack = err.stack;
      errorResponse.details = err instanceof AppError ? err.context : undefined;
    }

    res.status(statusCode).json(errorResponse);
  });

  return app;
}
