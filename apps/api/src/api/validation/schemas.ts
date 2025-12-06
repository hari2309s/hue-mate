import { z } from 'zod';
import { config } from '@hue-und-you/config';

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
] as const;

// Calculate max base64 size (accounting for 33% overhead)
const MAX_BASE64_SIZE = Math.floor((config.app.maxImageSizeMB * 1024 * 1024 * 4) / 3);

export const uploadImageSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long')
    .regex(/^[^<>:"/\\|?*\x00-\x1F]+$/, 'Invalid filename characters'),
  contentType: z.enum(ALLOWED_MIME_TYPES, {
    message: 'Unsupported file type',
  }),
  base64Data: z
    .string()
    .min(1, 'Image data is required')
    .max(MAX_BASE64_SIZE, `Image exceeds ${config.app.maxImageSizeMB}MB limit`)
    .regex(/^[A-Za-z0-9+/=]+$/, 'Invalid base64 format')
    .refine(
      (data) => {
        try {
          const sizeBytes = Buffer.byteLength(data, 'base64');
          return sizeBytes <= config.app.maxImageSizeMB * 1024 * 1024;
        } catch {
          return false;
        }
      },
      {
        message: `Decoded image exceeds ${config.app.maxImageSizeMB}MB`,
      }
    ),
});

export const processImageSchema = z.object({
  imageId: z.uuid('Invalid image ID format'),
  options: z
    .object({
      numColors: z
        .number()
        .int()
        .min(3, 'Must extract at least 3 colors')
        .max(20, 'Cannot extract more than 20 colors')
        .optional(),
      includeBackground: z.boolean().default(true),
      generateHarmonies: z.boolean().default(true),
    })
    .optional(),
});

export const getResultSchema = z.object({
  imageId: z.uuid('Invalid image ID format'),
});

export type UploadImageInput = z.infer<typeof uploadImageSchema>;
export type ProcessImageInput = z.infer<typeof processImageSchema>;
export type GetResultInput = z.infer<typeof getResultSchema>;
