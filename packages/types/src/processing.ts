import type { ColorPaletteResult } from './extraction';

/**
 * Processing job status and data
 */
export interface JobData {
  status: 'idle' | 'uploading' | 'processing' | 'segmenting' | 'extracting' | 'complete' | 'error';
  progress: number;
  message: string;
  result?: ColorPaletteResult;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Image storage data
 */
export interface ImageData {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

/**
 * Processing options for color extraction
 */
export interface ProcessingOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}
