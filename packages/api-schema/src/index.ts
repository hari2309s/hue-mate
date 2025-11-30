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
      numColors: z.number().min(3).max(20),
      includeBackground: z.boolean().default(true),
      generateHarmonies: z.boolean().default(true),
    })
    .optional(),
});

export const getResultSchema = z.object({
  imageId: z.string(),
});

// Export types inferred from schemas
export type UploadImageInput = z.infer<typeof uploadImageSchema>;
export type ProcessImageInput = z.infer<typeof processImageSchema>;
export type GetResultInput = z.infer<typeof getResultSchema>;

// Re-export trpc utilities
export { router, publicProcedure } from './trpc';
