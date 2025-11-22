'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { UploadStatus, UploadProgress, ColorPaletteResult } from '@hue-und-you/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

const STATUS_MESSAGES: Record<UploadStatus, string> = {
  idle: 'Ready to upload',
  uploading: 'Uploading image...',
  processing: 'Processing image...',
  segmenting: 'Segmenting foreground/background...',
  extracting: 'Extracting dominant colors...',
  complete: 'Color extraction complete!',
  error: 'An error occurred',
};

export function useImageUpload(): UseImageUploadReturn {
  const [progress, setProgress] = useState<UploadProgress>({
    status: 'idle',
    progress: 0,
    message: STATUS_MESSAGES.idle,
  });
  const [result, setResult] = useState<ColorPaletteResult | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

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

  const fileToBase64 = (file: File): Promise<string> => {
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
  };

  const pollStatus = useCallback(
    async (imageId: string) => {
      try {
        const res = await fetch(
          `${API_URL}/trpc/getProcessingStatus?input=${encodeURIComponent(JSON.stringify({ imageId }))}`
        );
        const data = await res.json();
        const statusData = data.result?.data;

        if (!statusData) return;

        updateProgress(statusData.status, statusData.progress, statusData.message);

        // Update toast based on status
        if (toastIdRef.current) {
          if (statusData.status === 'complete') {
            toast.success('Color extraction complete!', { id: toastIdRef.current });
          } else if (statusData.status === 'error') {
            toast.error(statusData.message || 'Processing failed', { id: toastIdRef.current });
          } else {
            toast.loading(statusData.message, { id: toastIdRef.current });
          }
        }

        if (statusData.status === 'complete') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          // Fetch result
          const resultRes = await fetch(
            `${API_URL}/trpc/getResult?input=${encodeURIComponent(JSON.stringify({ imageId }))}`
          );
          const resultData = await resultRes.json();
          if (resultData.result?.data) {
            setResult(resultData.result.data);
          }
        } else if (statusData.status === 'error') {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    },
    [updateProgress]
  );

  const upload = useCallback(
    async (file: File, options: UploadOptions = {}) => {
      // Reset state
      setResult(null);
      updateProgress('uploading', 5, 'Preparing upload...');

      // Show loading toast
      toastIdRef.current = toast.loading('Uploading image...');

      try {
        // Convert file to base64
        const base64Data = await fileToBase64(file);
        updateProgress('uploading', 15, 'Uploading to server...');

        // Upload image
        const uploadRes = await fetch(`${API_URL}/trpc/uploadImage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            base64Data,
          }),
        });

        if (!uploadRes.ok) {
          throw new Error('Upload failed');
        }

        const uploadData = await uploadRes.json();
        const imageId = uploadData.result?.data?.imageId;

        if (!imageId) {
          throw new Error('No image ID returned');
        }

        updateProgress('processing', 25, 'Starting color extraction...');
        toast.loading('Processing image...', { id: toastIdRef.current });

        // Start processing
        const processRes = await fetch(`${API_URL}/trpc/processImage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId,
            options: {
              numColors: options.numColors ?? 5,
              includeBackground: options.includeBackground ?? true,
              generateHarmonies: options.generateHarmonies ?? true,
            },
          }),
        });

        if (!processRes.ok) {
          throw new Error('Processing request failed');
        }

        // Start polling for status
        pollingRef.current = setInterval(() => pollStatus(imageId), 1000);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        updateProgress('error', 0, errorMsg, errorMsg);
        toast.error(errorMsg, { id: toastIdRef.current });
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
