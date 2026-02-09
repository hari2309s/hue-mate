import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@hute-mate/api/types';

export const trpc = createTRPCReact<AppRouter>();
