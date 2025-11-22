import { z } from 'zod';
// Zod Schemas
export const uploadImageSchema = z.object({
    filename: z.string(),
    contentType: z.string(),
    base64Data: z.string(),
});
export const processImageSchema = z.object({
    imageId: z.string(),
    options: z
        .object({
        numColors: z.number().min(1).max(20).default(5),
        includeBackground: z.boolean().default(true),
        generateHarmonies: z.boolean().default(true),
    })
        .optional(),
});
export const getResultSchema = z.object({
    imageId: z.string(),
});
// Re-export trpc utilities
export { router, publicProcedure } from './trpc';
//# sourceMappingURL=index.js.map