'use client';

import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImagePreviewProps {
  imageSrc: string | null;
}

export default function ImagePreview({ imageSrc }: ImagePreviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ scale: 1.01 }}
      style={{ borderColor: imageSrc ? 'var(--color-soft-orange)' : 'var(--muted-foreground)' }}
      className="flex h-full min-h-[320px] w-full items-center justify-center rounded-md border border-dashed bg-var(--card)"
    >
      <AnimatePresence mode="wait">
        {imageSrc ? (
          <motion.div
            key="image"
            initial={{ opacity: 0.2, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="relative h-full w-full min-h-[320px] overflow-hidden rounded-[calc(var(--radius-2xl)-2px)] bg-var(--muted)"
          >
            <Image
              src={imageSrc}
              alt="Uploaded preview"
              fill
              sizes="(max-width: 1024px) 100vw, 360px"
              className="object-contain"
              priority
              unoptimized
            />
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="flex h-full w-full flex-col items-center justify-center gap-3 py-12 text-var(--muted-foreground)"
          >
            <ImageIcon className="h-10 w-10 text-soft-orange" />
            <p className="text-sm">Image preview</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

