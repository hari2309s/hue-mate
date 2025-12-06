import type { ColorPaletteResult } from './extraction';

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'segmenting'
  | 'extracting'
  | 'complete'
  | 'error';

export interface UploadProgress {
  status: UploadStatus;
  progress: number;
  message: string;
  error?: string;
}

export interface ColorPalette {
  id: number;
  name: string;
  colors: string[];
  description?: string;
  result?: ColorPaletteResult;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface User {
  id: number;
  email: string;
  name?: string;
}

export interface UploadImageInput {
  filename: string;
  contentType: string;
  base64Data: string;
}

export interface UploadImageResponse {
  success: boolean;
  imageId: string;
  message: string;
}

export interface ProcessImageInput {
  imageId: string;
  options?: {
    numColors?: number;
    includeBackground?: boolean;
    generateHarmonies?: boolean;
  };
}
