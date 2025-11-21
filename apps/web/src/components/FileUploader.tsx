'use client';

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, File } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

interface FileWithPreview extends File {
  preview?: string;
}

interface FileDropzoneProps {
  onFilesChange?: (files: FileWithPreview[]) => void;
  maxSizeMB?: number;
  acceptedTypes?: string[];
}

const MAX_SIZE_MB = 10;

const FileUploader = ({
  onFilesChange,
  maxSizeMB = MAX_SIZE_MB,
  acceptedTypes,
}: FileDropzoneProps) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const maxBytes = maxSizeMB * 1024 * 1024;

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
    (incomingFiles: FileList | File[]) => {
      const fileArray = Array.from(incomingFiles);
      const validFiles: FileWithPreview[] = [];
      const errors: string[] = [];

      fileArray.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          const fileWithPreview = file as FileWithPreview;
          if (file.type.startsWith('image/')) {
            fileWithPreview.preview = URL.createObjectURL(file);
          }
          validFiles.push(fileWithPreview);
        }
      });

      if (errors.length > 0) {
        errors.forEach((err) => toast.error(err));
      }

      if (validFiles.length > 0) {
        const newFiles = [...files, ...validFiles];
        setFiles(newFiles);
        onFilesChange?.(newFiles);
        toast.success(`${validFiles.length} file(s) added successfully`);
      }
    },
    [files, validateFile, onFilesChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

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

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        processFiles(droppedFiles);
      }
    },
    [processFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        processFiles(selectedFiles);
      }
      e.target.value = '';
    },
    [processFiles]
  );

  const removeFile = useCallback(
    (index: number) => {
      const fileToRemove = files[index];
      if (fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      const newFiles = files.filter((_, i) => i !== index);
      setFiles(newFiles);
      onFilesChange?.(newFiles);
      toast.info('File removed');
    },
    [files, onFilesChange]
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        }}
        transition={{ duration: 0.2 }}
        className="relative rounded-2xl border-2 border-dashed bg-var(--card) p-8 text-center transition-colors"
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept={acceptedTypes?.join(',')}
        />

        <motion.div
          animate={{ y: isDragging ? -5 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{
              scale: isDragging ? 1.2 : 1,
              rotate: isDragging ? 10 : 0,
            }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="rounded-full bg-var(--muted) p-4"
          >
            <Upload className="h-8 w-8 text-soft-orange" />
          </motion.div>

          <div>
            <p className="text-lg font-medium text-var(--foreground)">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="mt-1 text-sm text-var(--muted-foreground)">
              or click to browse • Max {maxSizeMB}MB per file
            </p>
          </div>
        </motion.div>
      </motion.div>

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
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 rounded-lg bg-var(--card) border border-var(--border) p-3"
              >
                {file.preview ? (
                  <Image
                    src={file.preview}
                    alt={file.name}
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
                    {formatFileSize(file.size)}
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => removeFile(index)}
                  className="rounded-full p-1.5 hover:bg-var(--muted) transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4 text-var(--muted-foreground)" />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FileUploader;
