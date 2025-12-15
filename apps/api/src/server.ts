import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { appRouter } from '@/trpc-router';
import { config } from '@hue-und-you/config';
import { logger } from '@hue-und-you/utils';

// Combined middleware for CORS and health check
const middleware = (req: any, res: any, next: () => void) => {
  // Handle health check endpoint for Render.com
  if (req.url === '/health' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // CORS headers
  const origin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  next();
};

// Create tRPC server
export const server = createHTTPServer({
  router: appRouter,
  createContext: ({ req, res }) => ({ req, res }),
  middleware,
  onError: ({ error, path }) => {
    logger.error(`tRPC error on ${path}:`, error);
  },
});

export function startServer() {
  server.listen(config.app.port);
  
  logger.success('tRPC server started', {
    url: `http://localhost:${config.app.port}`,
    endpoints: {
      health: '/health',
      uploadImage: '/uploadImage',
      processImage: '/processImage',
      getProcessingStatus: '/getProcessingStatus',
      getResult: '/getResult',
    },
  });
}