'use client';

import { useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/src/stores/useAppStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const POLLING_INTERVAL_MS = 2000;
const MAX_POLLING_ATTEMPTS = 300; // 5 minutes max
const UPLOAD_PROGRESS_STEPS = {
  PREPARING: 5,
  UPLOADING: 15,
  PROCESSING: 25,
} as const;

// Cold start retry configuration
const COLD_START_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_TIMEOUT: 15000, // 15 seconds for first attempt
  EXTENDED_TIMEOUT: 45000, // 45 seconds for retries (cold start)
  RETRY_DELAY: 3000, // 3 seconds between retries
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
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

class TimeoutError extends UploadError {
  constructor(
    operation: string,
    public readonly isColdStart: boolean = false
  ) {
    super(
      isColdStart
        ? `Server is starting up (cold start). This may take up to 60 seconds...`
        : `Operation timed out: ${operation}`,
      'TIMEOUT_ERROR',
      408,
      isColdStart // Cold start timeouts are retryable
    );
  }
}

class ValidationError extends UploadError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400, false);
  }
}

// Utility functions
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string,
  isColdStartRetry: boolean = false
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new TimeoutError(operation, isColdStartRetry)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

async function fetchWithColdStartRetry(
  url: string,
  options: RequestInit,
  attemptNumber: number = 1
): Promise<Response> {
  const isColdStartAttempt = attemptNumber > 1;
  const timeout = isColdStartAttempt
    ? COLD_START_CONFIG.EXTENDED_TIMEOUT
    : COLD_START_CONFIG.INITIAL_TIMEOUT;

  try {
    const response = await withTimeout(
      fetch(url, {
        ...options,
        signal: options.signal,
      }),
      timeout,
      'API request',
      isColdStartAttempt
    );

    return response;
  } catch (error) {
    // Check if this is a timeout or network error that might be due to cold start
    const isColdStartError =
      error instanceof TimeoutError ||
      (error instanceof TypeError && error.message.includes('fetch'));

    if (isColdStartError && attemptNumber < COLD_START_CONFIG.MAX_RETRIES) {
      // Don't retry if aborted by user
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      console.log(
        `[Cold Start] Attempt ${attemptNumber} failed, retrying in ${COLD_START_CONFIG.RETRY_DELAY / 1000}s...`
      );

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, COLD_START_CONFIG.RETRY_DELAY));

      // Recursive retry
      return fetchWithColdStartRetry(url, options, attemptNumber + 1);
    }

    // Max retries exceeded or non-retryable error
    if (isColdStartError && attemptNumber >= COLD_START_CONFIG.MAX_RETRIES) {
      throw new UploadError(
        'Server is taking too long to respond. Please try again in a few moments.',
        'COLD_START_TIMEOUT',
        408,
        false
      );
    }

    throw error;
  }
}

function parseErrorResponse(error: unknown): { message: string; code: string; retryable: boolean } {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      message: 'Unable to connect to server. The server may be starting up, please wait...',
      code: 'NETWORK_ERROR',
      retryable: true,
    };
  }

  // Timeout errors
  if (error instanceof TimeoutError) {
    return {
      message: error.isColdStart
        ? 'Server is warming up. Retrying automatically...'
        : error.message,
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

  // Check if error has a statusCode property
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const statusCode = (error as { statusCode: number }).statusCode;

    if (statusCode === 413) {
      return {
        message: 'Image file is too large. Please use a smaller image.',
        code: 'FILE_TOO_LARGE',
        retryable: false,
      };
    }

    if (statusCode === 429) {
      return {
        message: 'Too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMIT',
        retryable: true,
      };
    }

    if (statusCode >= 500) {
      return {
        message: 'Server error. Please try again later.',
        code: 'SERVER_ERROR',
        retryable: true,
      };
    }
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

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptsRef = useRef(0);
  const toastIdRef = useRef<string | number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);

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

  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    pollingAttemptsRef.current = 0;
    retryCountRef.current = 0;
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
      if (!isMountedRef.current || !abortControllerRef.current) {
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
        const response = await fetchWithColdStartRetry(
          `${API_URL}/trpc/getProcessingStatus?input=${encodeURIComponent(JSON.stringify({ imageId }))}`,
          { signal: abortControllerRef.current.signal }
        );

        if (!response.ok) {
          throw new UploadError(
            'Failed to get processing status',
            'STATUS_CHECK_FAILED',
            response.status
          );
        }

        const data = await response.json();
        const statusData = data.result?.data;

        if (!isMountedRef.current || !statusData) return;

        updateProgress(statusData.status, statusData.progress, statusData.message);
        updateToast(statusData.status, statusData.message);

        if (statusData.status === 'complete') {
          cleanup();

          const resultResponse = await fetchWithColdStartRetry(
            `${API_URL}/trpc/getResult?input=${encodeURIComponent(JSON.stringify({ imageId }))}`,
            { signal: abortControllerRef.current?.signal || new AbortController().signal }
          );

          if (resultResponse.ok) {
            const resultData = await resultResponse.json();
            const fetchedResult = resultData.result?.data;

            if (isMountedRef.current && fetchedResult) {
              setResult(fetchedResult);
            }
          }
        } else if (statusData.status === 'error') {
          cleanup();
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

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
    [updateProgress, updateToast, setResult, cleanup]
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
      retryCountRef.current = 0;

      // Cancel any existing upload
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      toastIdRef.current = toast.loading('Connecting to server...');

      try {
        // Convert file to base64 with timeout
        const base64Data = await withTimeout(fileToBase64(file), 30000, 'file processing');

        if (!isMountedRef.current) return;

        updateProgress('uploading', UPLOAD_PROGRESS_STEPS.UPLOADING, 'Uploading to server...');
        toast.loading('Uploading image...', { id: toastIdRef.current });

        // Upload image with cold start retry
        const uploadResponse = await fetchWithColdStartRetry(`${API_URL}/trpc/uploadImage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            base64Data,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new UploadError(
            errorData.error || 'Upload failed',
            errorData.code || 'UPLOAD_FAILED',
            uploadResponse.status,
            uploadResponse.status >= 500
          );
        }

        const uploadData = await uploadResponse.json();
        const imageId = uploadData.result?.data?.imageId;

        if (!imageId) {
          throw new UploadError('No image ID returned from server', 'NO_IMAGE_ID');
        }

        if (!isMountedRef.current) return;

        updateProgress(
          'processing',
          UPLOAD_PROGRESS_STEPS.PROCESSING,
          'Starting color extraction...'
        );
        toast.loading('Processing image...', { id: toastIdRef.current });

        // Start processing with cold start retry
        const processResponse = await fetchWithColdStartRetry(`${API_URL}/trpc/processImage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId,
            options: {
              numColors: options.numColors,
              includeBackground: options.includeBackground ?? true,
              generateHarmonies: options.generateHarmonies ?? true,
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!processResponse.ok) {
          throw new UploadError(
            'Failed to start processing',
            'PROCESS_START_FAILED',
            processResponse.status
          );
        }

        if (!isMountedRef.current) return;

        // Start polling
        pollingAttemptsRef.current = 0;
        pollingRef.current = setInterval(() => pollStatus(imageId), POLLING_INTERVAL_MS);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

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
    [updateProgress, pollStatus, setResult, cleanup]
  );

  return { upload, cancel };
}
