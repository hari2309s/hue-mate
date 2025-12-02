'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, FileIcon, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useImageUpload } from '@/src/hooks/useImageUpload';
import { useAppStore } from '@/src/stores/useAppStore';

interface FileWithPreview extends File {
  preview?: string;
}

interface FileUploaderProps {
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

const MAX_SIZE_MB = 10;

const FileUploader = ({
  maxSizeMB = MAX_SIZE_MB,
  acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
}: FileUploaderProps) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const progress = useAppStore((state) => state.progress);
  const isUploading = useAppStore((state) => state.isUploading);
  const isProcessing = useAppStore((state) => state.isProcessing);
  const isComplete = useAppStore((state) => state.isComplete);
  const hasError = useAppStore((state) => state.hasError);
  const setPreviewSrc = useAppStore((state) => state.setPreviewSrc);
  const reset = useAppStore((state) => state.reset);

  const { upload } = useImageUpload();

  const maxBytes = maxSizeMB * 1024 * 1024;
  const isBusy = isUploading || isProcessing;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxBytes) {
        return `File "${file.name}" exceeds ${maxSizeMB}MB limit`;
      }
      if (acceptedTypes && acceptedTypes.length > 0) {
        const isAccepted = acceptedTypes.some(
          (type) => file.type === type || file.name.toLowerCase().endsWith(type.replace('*', ''))
        );
        if (!isAccepted) {
          return `File "${file.name}" is not an accepted type`;
        }
      }
      return null;
    },
    [maxBytes, maxSizeMB, acceptedTypes]
  );

  const processFiles = useCallback(
    async (incomingFiles: FileList | File[]) => {
      if (isBusy) {
        toast.warning('Please wait for current upload to complete');
        return;
      }

      const fileArray = Array.from(incomingFiles);
      const errors: string[] = [];
      let validFile: FileWithPreview | null = null;

      // Only process first valid file
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else if (!validFile) {
          const fileWithPreview = file as FileWithPreview;
          if (file.type.startsWith('image/')) {
            fileWithPreview.preview = URL.createObjectURL(file);
          }
          validFile = fileWithPreview;
          break;
        }
      }

      if (errors.length > 0) {
        errors.forEach((err) => toast.error(err));
      }

      if (validFile) {
        // Clear previous files
        files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
        setFiles([validFile]);
        setPreviewSrc(validFile.preview ?? null);

        await upload(validFile, {
          numColors: 20,
          includeBackground: true,
          generateHarmonies: true,
        });
      }
    },
    [files, validateFile, upload, isBusy, setPreviewSrc]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isBusy) setIsDragging(true);
    },
    [isBusy]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (isBusy) return;

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        processFiles(droppedFiles);
      }
    },
    [processFiles, isBusy]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isBusy) return;

      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        processFiles(selectedFiles);
      }
      e.target.value = '';
    },
    [processFiles, isBusy]
  );

  const removeFile = useCallback(
    (index: number) => {
      const fileToRemove = files[index];
      if (fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      const newFiles = files.filter((_, i) => i !== index);
      setFiles(newFiles);
      setPreviewSrc(newFiles[0]?.preview ?? null);
      reset();
    },
    [files, reset, setPreviewSrc]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = () => {
    if (isUploading || isProcessing)
      return <Loader2 className="h-5 w-5 animate-spin text-soft-orange" aria-hidden="true" />;
    if (isComplete) return <CheckCircle className="h-5 w-5 text-green-500" aria-label="Complete" />;
    if (hasError) return <AlertCircle className="h-5 w-5 text-red-500" aria-label="Error" />;
    return null;
  };

  return (
    <div className="flex h-full w-full flex-col">
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        initial={{ opacity: 0, y: 16 }}
        animate={{
          opacity: isBusy ? 0.7 : 1,
          y: 0,
          scale: isDragging ? 1.02 : 1,
          borderColor: isDragging ? 'var(--color-soft-orange)' : 'var(--muted-foreground)',
        }}
        transition={{ duration: 0.2 }}
        className={`relative flex min-h-80 flex-1 flex-col rounded-md border border-dashed bg-(--card) p-8 text-center transition-colors ${isBusy ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        role="button"
        aria-label="Upload image file by clicking or dragging"
        tabIndex={isBusy ? -1 : 0}
      >
        <input
          type="file"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          accept={acceptedTypes?.join(',')}
          disabled={isBusy}
          aria-label={`Upload image file. Max size: ${maxSizeMB}MB. Accepted types: ${acceptedTypes?.join(', ')}`}
        />

        <motion.div
          animate={{ y: isDragging ? -5 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 flex-col items-center justify-center gap-4"
        >
          <motion.div
            animate={{ scale: isDragging ? 1.2 : 1, rotate: isDragging ? 10 : 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="rounded-full bg-(--muted) p-4"
            aria-hidden="true"
          >
            {isBusy ? (
              <Loader2 className="h-8 w-8 text-soft-orange animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-soft-orange" />
            )}
          </motion.div>

          <div>
            <p className="text-lg font-medium text-(--foreground)">
              {isBusy ? progress.message : isDragging ? 'Drop files here' : 'Drag & drop an image'}
            </p>
            <p className="mt-1 text-sm text-(--muted-foreground)">
              {isBusy
                ? `${progress.progress}% complete`
                : `or click to browse • Max ${maxSizeMB}MB`}
            </p>
          </div>
        </motion.div>

        {/* Progress bar */}
        {isBusy && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            className="absolute bottom-0 left-0 right-0 h-1 bg-(--muted) rounded-b-2xl overflow-hidden"
            role="progressbar"
            aria-valuenow={progress.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Upload progress: ${progress.progress}%`}
          >
            <motion.div
              className="h-full bg-soft-orange"
              initial={{ width: 0 }}
              animate={{ width: `${progress.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </motion.div>
        )}
      </motion.div>

      {/* File preview */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 max-h-48 space-y-2 overflow-auto pr-1"
            role="list"
            aria-label="Selected files"
          >
            {files.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 rounded-md bg-(--card) border border-(--border) p-3"
                role="listitem"
              >
                {file.preview ? (
                  <Image
                    src={file.preview}
                    alt={`Preview of ${file.name}`}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-(--muted)">
                    <FileIcon className="h-5 w-5 text-(--muted-foreground)" aria-hidden="true" />
                  </div>
                )}

                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-(--foreground)">{file.name}</p>
                    <p className="text-xs text-(--muted-foreground)">
                      {formatFileSize(file.size)} • {progress.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  {!isBusy && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => removeFile(index)}
                      disabled={isBusy}
                      className="rounded-sm p-1.5 hover:bg-(--muted) transition-colors disabled:opacity-50"
                      aria-label={`Remove ${file.name}`}
                      type="button"
                    >
                      <X className="h-6 w-6 text-(--muted-foreground) cursor-pointer hover:text-red-500" />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUploader;
