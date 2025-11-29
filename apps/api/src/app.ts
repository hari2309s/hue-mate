import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './api/trpc/router';
import streamRoute from './api/routes/stream.route';
import { logger } from './utils';
import { RATE_LIMIT_CONFIG } from './config';

// Rate limiters
const uploadLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.UPLOAD_WINDOW_MS,
  max: RATE_LIMIT_CONFIG.UPLOAD_MAX_REQUESTS,
  message: {
    error: 'Too many upload requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: 'Too many upload requests, please try again later',
    });
  },
});

const processLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.PROCESS_WINDOW_MS,
  max: RATE_LIMIT_CONFIG.PROCESS_MAX_REQUESTS,
  message: {
    error: 'Too many processing requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Process rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      imageId: req.params.imageId,
    });
    res.status(429).json({
      error: 'Too many processing requests, please try again later',
    });
  },
});

export function createApp() {
  const app = express();

  // Trust proxy for rate limiting
  app.set('trust proxy', 1);

  // CORS
  app.use(cors());

  // Body parser with size limit
  app.use(express.json({ limit: '50mb' }));

  // Health check (no rate limit)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Stream route with rate limiting
  app.use('/stream', processLimiter, streamRoute);

  // tRPC with rate limiting on upload
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => {
        if (req.url?.includes('uploadImage')) {
          return new Promise((resolve, reject) => {
            uploadLimiter(req as any, res as any, (err?: any) => {
              if (err) reject(err);
              else resolve({});
            });
          });
        }
        return {};
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
      error: 'Not found',
      path: req.path,
    });
  });

  // Global error handler (must be last)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    // Don't send error if headers already sent
    if (res.headersSent) {
      return next(err);
    }

    const statusCode = err.statusCode || err.status || 500;
    const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

    res.status(statusCode).json({
      error: message,
      ...(process.env.NODE_ENV !== 'production' && {
        stack: err.stack,
      }),
    });
  });

  return app;
}
