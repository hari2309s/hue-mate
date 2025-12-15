import { initTRPC, TRPCError } from '@trpc/server';
import type { IncomingMessage, ServerResponse } from 'http';

// Context type for tRPC
export interface Context {
  req: IncomingMessage;
  res: ServerResponse;
}

const t = initTRPC.context<Context>().create();

// Rate limiting state (in-memory for simplicity)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
const rateLimitMiddleware = (windowMs: number, maxRequests: number) =>
  t.middleware(({ ctx, next }) => {
    const ip = ctx.req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const key = `${ip}`;
    
    const current = rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      // Reset or initialize
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (current.count >= maxRequests) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests, please try again later',
      });
    }
    
    current.count++;
    return next();
  });

// Logging middleware
const loggingMiddleware = t.middleware(({ path, type, next, ctx }) => {
  const start = Date.now();
  
  return next({
    ctx: {
      ...ctx,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    },
  }).then((result) => {
    const duration = Date.now() - start;
    console.log(`[${type}] ${path} - ${duration}ms`);
    return result;
  });
});

export const router = t.router;
export const publicProcedure = t.procedure.use(loggingMiddleware);
export const uploadProcedure = publicProcedure.use(rateLimitMiddleware(60000, 10)); // 10 uploads per minute
export const processProcedure = publicProcedure.use(rateLimitMiddleware(60000, 20)); // 20 processes per minute
export const middleware = t.middleware;
