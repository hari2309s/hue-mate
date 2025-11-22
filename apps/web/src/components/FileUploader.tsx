'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, File, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { useImageUpload } from '@/src/hooks/useImageUpload';
import type { ColorPaletteResult } from '@hue-und-you/types';

interface FileWithPreview extends File {
  preview?: string;
}

interface FileUploaderProps {
  onResultChange?: (result: ColorPaletteResult | null) => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

const MAX_SIZE_MB = 10;

const FileUploader = ({
  onResultChange,
  maxSizeMB = MAX_SIZE_MB,
  acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
}: FileUploaderProps) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { upload, progress, result, reset, isUploading, isProcessing, isComplete, hasError } =
    useImageUpload();

  const maxBytes = maxSizeMB * 1024 * 1024;
  const isBusy = isUploading || isProcessing;

  // Notify parent of result changes
  if (result && onResultChange) {
    onResultChange(result);
  }

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

        // Start upload
        await upload(validFile, { numColors: 5, includeBackground: true, generateHarmonies: true });
      }
    },
    [files, validateFile, upload, isBusy]
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
      reset();
      onResultChange?.(null);
    },
    [files, reset, onResultChange]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusIcon = () => {
    if (isUploading || isProcessing)
      return <Loader2 className="h-5 w-5 animate-spin text-soft-orange" />;
    if (isComplete) return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (hasError) return <AlertCircle className="h-5 w-5 text-red-500" />;
    return null;
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        animate={{
          scale: isDragging ? 1.02 : 1,
          borderColor: isDragging ? 'var(--color-soft-orange)' : 'var(--border)',
          opacity: isBusy ? 0.7 : 1,
        }}
        transition={{ duration: 0.2 }}
        className={`relative rounded-2xl border-2 border-dashed bg-var(--card) p-8 text-center transition-colors ${isBusy ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <input
          type="file"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          accept={acceptedTypes?.join(',')}
          disabled={isBusy}
        />

        <motion.div
          animate={{ y: isDragging ? -5 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ scale: isDragging ? 1.2 : 1, rotate: isDragging ? 10 : 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="rounded-full bg-var(--muted) p-4"
          >
            {isBusy ? (
              <Loader2 className="h-8 w-8 text-soft-orange animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-soft-orange" />
            )}
          </motion.div>

          <div>
            <p className="text-lg font-medium text-var(--foreground)">
              {isBusy ? progress.message : isDragging ? 'Drop files here' : 'Drag & drop an image'}
            </p>
            <p className="mt-1 text-sm text-var(--muted-foreground)">
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
            className="absolute bottom-0 left-0 right-0 h-1 bg-var(--muted) rounded-b-2xl overflow-hidden"
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
            className="mt-4 space-y-2"
          >
            {files.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 rounded-lg bg-var(--card) border border-var(--border) p-3"
              >
                {file.preview ? (
                  <Image
                    src={file.preview}
                    alt={file.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-var(--muted)">
                    <File className="h-5 w-5 text-var(--muted-foreground)" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-var(--foreground)">{file.name}</p>
                  <p className="text-xs text-var(--muted-foreground)">
                    {formatFileSize(file.size)} • {progress.message}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeFile(index)}
                    disabled={isBusy}
                    className="rounded-full p-1.5 hover:bg-var(--muted) transition-colors disabled:opacity-50"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4 text-var(--muted-foreground)" />
                  </motion.button>
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
