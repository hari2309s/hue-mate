import { create } from 'zustand';
import type { ColorPaletteResult, UploadProgress, UploadStatus } from '@hue-und-you/types';

interface AppState {
  // Image preview
  previewSrc: string | null;
  setPreviewSrc: (src: string | null) => void;

  // Upload progress
  progress: UploadProgress;
  setProgress: (progress: UploadProgress) => void;
  updateProgress: (
    status: UploadStatus,
    progressVal: number,
    message?: string,
    error?: string
  ) => void;

  // Result
  result: ColorPaletteResult | null;
  setResult: (result: ColorPaletteResult | null) => void;

  // Computed states
  isUploading: boolean;
  isProcessing: boolean;
  isComplete: boolean;
  hasError: boolean;

  // Actions
  reset: () => void;
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

const initialProgress: UploadProgress = {
  status: 'idle',
  progress: 0,
  message: STATUS_MESSAGES.idle,
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  previewSrc: null,
  progress: initialProgress,
  result: null,
  isUploading: false,
  isProcessing: false,
  isComplete: false,
  hasError: false,

  // Setters
  setPreviewSrc: (src) => set({ previewSrc: src }),

  setProgress: (progress) =>
    set({
      progress,
      isUploading: progress.status === 'uploading',
      isProcessing: ['processing', 'segmenting', 'extracting'].includes(progress.status),
      isComplete: progress.status === 'complete',
      hasError: progress.status === 'error',
    }),

  updateProgress: (status, progressVal, message, error) =>
    get().setProgress({
      status,
      progress: progressVal,
      message: message || STATUS_MESSAGES[status],
      error,
    }),

  setResult: (result) => set({ result }),

  // Reset
  reset: () =>
    set({
      previewSrc: null,
      progress: initialProgress,
      result: null,
      isUploading: false,
      isProcessing: false,
      isComplete: false,
      hasError: false,
    }),
}));
