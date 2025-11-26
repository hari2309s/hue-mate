import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './api/trpc/router';
import streamRoute from './api/routes/stream.route';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/stream', streamRoute);
  app.use('/trpc', createExpressMiddleware({ router: appRouter }));

  return app;
}
