'use client';

import { useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/src/stores/useAppStore';
import { trpc } from '@/src/lib/trpc';

const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_ATTEMPTS = 300; // 5 minutes max
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
  cancel: () => void;
}

// Custom error classes
class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

class TimeoutError extends UploadError {
  constructor(operation: string) {
    super(`Operation timed out: ${operation}`, 'TIMEOUT_ERROR', false);
  }
}

class ValidationError extends UploadError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', false);
  }
}

// Utility functions
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(operation)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

function parseErrorResponse(error: unknown): { message: string; code: string; retryable: boolean } {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: 'Unable to connect to server. Please check your connection.',
      code: 'NETWORK_ERROR',
      retryable: true,
    };
  }

  // Timeout errors
  if (error instanceof TimeoutError) {
    return {
      message: error.message,
      code: error.code,
      retryable: error.retryable,
    };
  }

  // Known upload errors
  if (error instanceof UploadError) {
    return {
      message: error.message,
      code: error.code,
      retryable: error.retryable,
    };
  }

  // Generic error
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
  return {
    message: errorMessage,
    code: 'UNKNOWN_ERROR',
    retryable: false,
  };
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(',')[1];

        if (!base64) {
          throw new Error('Failed to extract base64 data');
        }

        resolve(base64);
      } catch {
        reject(new UploadError('Failed to process file', 'FILE_READ_ERROR'));
      }
    };

    reader.onerror = () => {
      reject(new UploadError('Failed to read file', 'FILE_READ_ERROR'));
    };

    reader.readAsDataURL(file);
  });
}

export function useImageUpload(): UseImageUploadReturn {
  const updateProgress = useAppStore((state) => state.updateProgress);
  const setResult = useAppStore((state) => state.setResult);

  // tRPC hooks
  const uploadMutation = trpc.uploadImage.useMutation();
  const processMutation = trpc.processImage.useMutation();
  const utils = trpc.useUtils();

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptsRef = useRef(0);
  const toastIdRef = useRef<string | number | null>(null);
  const isMountedRef = useRef(true);
  const currentImageIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };
  }, []);

  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    pollingAttemptsRef.current = 0;
    currentImageIdRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    cleanup();
    updateProgress('idle', 0, 'Cancelled');

    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }

    toast.info('Upload cancelled');
  }, [cleanup, updateProgress]);

  const updateToast = useCallback((status: string, message: string) => {
    if (!isMountedRef.current || !toastIdRef.current) return;

    if (status === 'complete') {
      toast.success('Color extraction complete!', { id: toastIdRef.current });
      toastIdRef.current = null;
    } else if (status === 'error') {
      toast.error(message, { id: toastIdRef.current, duration: 6000 });
      toastIdRef.current = null;
    } else {
      toast.loading(message, { id: toastIdRef.current });
    }
  }, []);

  const pollStatus = useCallback(
    async (imageId: string) => {
      if (!isMountedRef.current) {
        return;
      }

      // Check max polling attempts
      pollingAttemptsRef.current++;
      if (pollingAttemptsRef.current > MAX_POLLING_ATTEMPTS) {
        cleanup();
        const error = new TimeoutError('processing');
        const errorInfo = parseErrorResponse(error);
        updateProgress('error', 0, errorInfo.message, errorInfo.message);
        updateToast('error', errorInfo.message);
        return;
      }

      try {
        console.log('[useImageUpload] Polling attempt:', pollingAttemptsRef.current, 'for imageId:', imageId);
        const statusData = await utils.getProcessingStatus.fetch({ imageId });
        console.log('[useImageUpload] Status data received:', {
          status: statusData.status,
          progress: statusData.progress,
          message: statusData.message
        });

        if (!isMountedRef.current || !statusData) return;

        updateProgress(statusData.status, statusData.progress, statusData.message);
        updateToast(statusData.status, statusData.message);

        if (statusData.status === 'complete') {
          console.log('[useImageUpload] Processing complete, fetching result...');
          cleanup();

          const resultData = await utils.getResult.fetch({ imageId });
          console.log('[useImageUpload] Result data received:', resultData ? 'success' : 'null');

          if (isMountedRef.current && resultData) {
            setResult(resultData);
          }
        } else if (statusData.status === 'error') {
          console.log('[useImageUpload] Processing error detected, stopping polling');
          cleanup();
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error('[useImageUpload] Polling error:', error);

          // Continue polling on transient errors
          const errorInfo = parseErrorResponse(error);
          if (!errorInfo.retryable) {
            cleanup();
            updateProgress('error', 0, errorInfo.message, errorInfo.message);
            updateToast('error', errorInfo.message);
          }
        }
      }
    },
    [updateProgress, updateToast, setResult, cleanup, utils]
  );

  const upload = useCallback(
    async (file: File, options: UploadOptions = {}) => {
      // Validate file
      if (!file || !(file instanceof File)) {
        throw new ValidationError('Invalid file provided');
      }

      if (file.size === 0) {
        throw new ValidationError('File is empty');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new ValidationError('File size exceeds 10MB limit');
      }

      setResult(null);
      updateProgress('uploading', UPLOAD_PROGRESS_STEPS.PREPARING, 'Preparing upload...');

      toastIdRef.current = toast.loading('Preparing image...');

      try {
        // Convert file to base64 with timeout
        const base64Data = await withTimeout(fileToBase64(file), 30000, 'file processing');

        if (!isMountedRef.current) return;

        updateProgress('uploading', UPLOAD_PROGRESS_STEPS.UPLOADING, 'Uploading to server...');
        toast.loading('Uploading image...', { id: toastIdRef.current });

        // Upload image using tRPC
        const uploadResult = await uploadMutation.mutateAsync({
          filename: file.name,
          contentType: file.type,
          base64Data,
        });

        const imageId = uploadResult.imageId;

        if (!imageId) {
          throw new UploadError('No image ID returned from server', 'NO_IMAGE_ID');
        }

        if (!isMountedRef.current) return;

        currentImageIdRef.current = imageId;

        updateProgress(
          'processing',
          UPLOAD_PROGRESS_STEPS.PROCESSING,
          'Starting color extraction...'
        );
        toast.loading('Processing image...', { id: toastIdRef.current });

        // Start processing using tRPC
        await processMutation.mutateAsync({
          imageId,
          options: {
            numColors: options.numColors,
            includeBackground: options.includeBackground ?? true,
            generateHarmonies: options.generateHarmonies ?? true,
          },
        });

        if (!isMountedRef.current) return;

        // Start polling
        pollingAttemptsRef.current = 0;
        console.log('[useImageUpload] Starting polling for imageId:', imageId, 'interval:', POLLING_INTERVAL_MS);
        pollingRef.current = setInterval(() => {
          console.log('[useImageUpload] Polling interval triggered');
          pollStatus(imageId);
        }, POLLING_INTERVAL_MS);
      } catch (error) {
        cleanup();

        const errorInfo = parseErrorResponse(error);

        if (isMountedRef.current) {
          updateProgress('error', 0, errorInfo.message, errorInfo.message);

          if (toastIdRef.current) {
            toast.error(errorInfo.message, { id: toastIdRef.current, duration: 6000 });
            toastIdRef.current = null;
          }
        }
      }
    },
    [updateProgress, pollStatus, setResult, cleanup, uploadMutation, processMutation]
  );

  return { upload, cancel };
}
