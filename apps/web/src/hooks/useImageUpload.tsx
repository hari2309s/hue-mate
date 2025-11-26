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

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImageToServer(
  filename: string,
  contentType: string,
  base64Data: string
): Promise<string> {
  const response = await fetch(`${API_URL}/trpc/uploadImage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, base64Data }),
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const data = await response.json();
  const imageId = data.result?.data?.imageId;

  if (!imageId) {
    throw new Error('No image ID returned');
  }

  return imageId;
}

async function startProcessing(imageId: string, options: UploadOptions): Promise<void> {
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
  });

  if (!response.ok) {
    throw new Error('Processing request failed');
  }
}

async function fetchProcessingStatus(imageId: string) {
  const response = await fetch(
    `${API_URL}/trpc/getProcessingStatus?input=${encodeURIComponent(JSON.stringify({ imageId }))}`
  );
  const data = await response.json();
  return data.result?.data;
}

async function fetchResult(imageId: string): Promise<ColorPaletteResult | null> {
  const response = await fetch(
    `${API_URL}/trpc/getResult?input=${encodeURIComponent(JSON.stringify({ imageId }))}`
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const updateProgress = useCallback(
    (status: UploadStatus, progressVal: number, message?: string, error?: string) => {
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
    if (!toastIdRef.current) return;

    if (status === 'complete') {
      toast.success('Color extraction complete!', { id: toastIdRef.current });
    } else if (status === 'error') {
      toast.error(message, { id: toastIdRef.current });
    } else {
      toast.loading(message, { id: toastIdRef.current });
    }
  }, []);

  const pollStatus = useCallback(
    async (imageId: string) => {
      try {
        const statusData = await fetchProcessingStatus(imageId);
        if (!statusData) return;

        updateProgress(statusData.status, statusData.progress, statusData.message);
        updateToast(statusData.status, statusData.message);

        if (statusData.status === 'complete') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          const fetchedResult = await fetchResult(imageId);
          if (fetchedResult) {
            setResult(fetchedResult);
          }
        } else if (statusData.status === 'error') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    },
    [updateProgress, updateToast]
  );

  const upload = useCallback(
    async (file: File, options: UploadOptions = {}) => {
      // Reset state
      setResult(null);
      updateProgress('uploading', UPLOAD_PROGRESS_STEPS.PREPARING, 'Preparing upload...');

      // Show loading toast
      toastIdRef.current = toast.loading('Uploading image...');

      try {
        // Convert file to base64
        const base64Data = await fileToBase64(file);
        updateProgress('uploading', UPLOAD_PROGRESS_STEPS.UPLOADING, 'Uploading to server...');

        // Upload image
        const imageId = await uploadImageToServer(file.name, file.type, base64Data);

        updateProgress(
          'processing',
          UPLOAD_PROGRESS_STEPS.PROCESSING,
          'Starting color extraction...'
        );
        toast.loading('Processing image...', { id: toastIdRef.current });

        // Start processing
        await startProcessing(imageId, options);

        // Start polling for status
        pollingRef.current = setInterval(() => pollStatus(imageId), POLLING_INTERVAL_MS);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        updateProgress('error', 0, errorMsg, errorMsg);
        toast.error(errorMsg, { id: toastIdRef.current });

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
    setProgress({ status: 'idle', progress: 0, message: STATUS_MESSAGES.idle });
    setResult(null);
    toastIdRef.current = null;
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
