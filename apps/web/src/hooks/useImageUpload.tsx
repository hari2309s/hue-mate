'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import type { UploadStatus, UploadProgress, ColorPaletteResult } from '@hue-und-you/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_MESSAGES: Record<UploadStatus, string> = {
  idle: 'Ready to upload',
  uploading: 'Uploading image...',
  processing: 'Processing image...',
  segmenting: 'Segmenting foreground/background...',
  extracting: 'Extracting dominant colors...',
  complete: 'Color extraction complete!',
  error: 'An error occurred',
} as const;

const POLLING_INTERVAL_MS = 1000;
const UPLOAD_PROGRESS_STEPS = {
  PREPARING: 5,
  UPLOADING: 15,
  PROCESSING: 25,
} as const;

interface UploadOptions {
  numColors?: number;
  includeBackground?: boolean;
  generateHarmonies?: boolean;
}

interface UseImageUploadReturn {
  upload: (file: File, options?: UploadOptions) => Promise<void>;
  progress: UploadProgress;
  result: ColorPaletteResult | null;
  reset: () => void;
  isUploading: boolean;
  isProcessing: boolean;
  isComplete: boolean;
  hasError: boolean;
}

class UploadError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new UploadError('Failed to read file', 'FILE_READ_ERROR'));
    reader.readAsDataURL(file);
  });
}

async function uploadImageToServer(
  filename: string,
  contentType: string,
  base64Data: string,
  signal: AbortSignal
): Promise<string> {
  const response = await fetch(`${API_URL}/trpc/uploadImage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, base64Data }),
    signal,
  });

  if (!response.ok) {
    throw new UploadError('Upload failed', 'UPLOAD_ERROR');
  }

  const data = await response.json();
  const imageId = data.result?.data?.imageId;

  if (!imageId) {
    throw new UploadError('No image ID returned', 'NO_IMAGE_ID');
  }

  return imageId;
}

async function startProcessing(
  imageId: string,
  options: UploadOptions,
  signal: AbortSignal
): Promise<void> {
  const response = await fetch(`${API_URL}/trpc/processImage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageId,
      options: {
        numColors: options.numColors ?? 10,
        includeBackground: options.includeBackground ?? true,
        generateHarmonies: options.generateHarmonies ?? true,
      },
    }),
    signal,
  });

  if (!response.ok) {
    throw new UploadError('Processing request failed', 'PROCESSING_ERROR');
  }
}

async function fetchProcessingStatus(imageId: string, signal: AbortSignal) {
  const response = await fetch(
    `${API_URL}/trpc/getProcessingStatus?input=${encodeURIComponent(JSON.stringify({ imageId }))}`,
    { signal }
  );
  const data = await response.json();
  return data.result?.data;
}

async function fetchResult(
  imageId: string,
  signal: AbortSignal
): Promise<ColorPaletteResult | null> {
  const response = await fetch(
    `${API_URL}/trpc/getResult?input=${encodeURIComponent(JSON.stringify({ imageId }))}`,
    { signal }
  );
  const data = await response.json();
  return data.result?.data ?? null;
}

export function useImageUpload(): UseImageUploadReturn {
  const [progress, setProgress] = useState<UploadProgress>({
    status: 'idle',
    progress: 0,
    message: STATUS_MESSAGES.idle,
  });
  const [result, setResult] = useState<ColorPaletteResult | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const toastIdRef = useRef<string | number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, []);

  const updateProgress = useCallback(
    (status: UploadStatus, progressVal: number, message?: string, error?: string) => {
      if (!isMountedRef.current) return;

      setProgress({
        status,
        progress: progressVal,
        message: message || STATUS_MESSAGES[status],
        error,
      });
    },
    []
  );

  const updateToast = useCallback((status: UploadStatus, message: string) => {
    if (!isMountedRef.current || !toastIdRef.current) return;

    if (status === 'complete') {
      toast.success('Color extraction complete!', { id: toastIdRef.current });
      toastIdRef.current = null;
    } else if (status === 'error') {
      toast.error(message, { id: toastIdRef.current });
      toastIdRef.current = null;
    } else {
      toast.loading(message, { id: toastIdRef.current });
    }
  }, []);

  const pollStatus = useCallback(
    async (imageId: string) => {
      if (!isMountedRef.current || abortControllerRef.current?.signal.aborted) {
        return;
      }

      try {
        const statusData = await fetchProcessingStatus(
          imageId,
          abortControllerRef.current?.signal || new AbortController().signal
        );

        if (!isMountedRef.current || !statusData) return;

        updateProgress(statusData.status, statusData.progress, statusData.message);
        updateToast(statusData.status, statusData.message);

        if (statusData.status === 'complete') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          const fetchedResult = await fetchResult(
            imageId,
            abortControllerRef.current?.signal || new AbortController().signal
          );

          if (isMountedRef.current && fetchedResult) {
            setResult(fetchedResult);
          }
        } else if (statusData.status === 'error') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        if (isMountedRef.current) {
          console.error('[useImageUpload] Polling error:', err);
        }
      }
    },
    [updateProgress, updateToast]
  );

  const upload = useCallback(
    async (file: File, options: UploadOptions = {}) => {
      setResult(null);
      updateProgress('uploading', UPLOAD_PROGRESS_STEPS.PREPARING, 'Preparing upload...');

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      toastIdRef.current = toast.loading('Uploading image...');

      try {
        const base64Data = await fileToBase64(file);

        if (abortControllerRef.current.signal.aborted || !isMountedRef.current) {
          return;
        }

        updateProgress('uploading', UPLOAD_PROGRESS_STEPS.UPLOADING, 'Uploading to server...');

        const imageId = await uploadImageToServer(
          file.name,
          file.type,
          base64Data,
          abortControllerRef.current.signal
        );

        if (abortControllerRef.current.signal.aborted || !isMountedRef.current) {
          return;
        }

        updateProgress(
          'processing',
          UPLOAD_PROGRESS_STEPS.PROCESSING,
          'Starting color extraction...'
        );
        toast.loading('Processing image...', { id: toastIdRef.current });

        await startProcessing(imageId, options, abortControllerRef.current.signal);

        if (abortControllerRef.current.signal.aborted || !isMountedRef.current) {
          return;
        }

        pollingRef.current = setInterval(() => pollStatus(imageId), POLLING_INTERVAL_MS);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const errorMsg =
          err instanceof UploadError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Upload failed';

        if (isMountedRef.current) {
          updateProgress('error', 0, errorMsg, errorMsg);

          if (toastIdRef.current) {
            toast.error(errorMsg, { id: toastIdRef.current });
            toastIdRef.current = null;
          }
        }

        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    },
    [updateProgress, pollStatus]
  );

  const reset = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    setProgress({ status: 'idle', progress: 0, message: STATUS_MESSAGES.idle });
    setResult(null);
  }, []);

  return {
    upload,
    progress,
    result,
    reset,
    isUploading: progress.status === 'uploading',
    isProcessing: ['processing', 'segmenting', 'extracting'].includes(progress.status),
    isComplete: progress.status === 'complete',
    hasError: progress.status === 'error',
  };
}
