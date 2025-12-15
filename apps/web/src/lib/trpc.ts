import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@hue-und-you/api/types';

export const trpc = createTRPCReact<AppRouter>();
