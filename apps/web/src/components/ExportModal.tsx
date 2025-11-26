'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  language?: string;
}

const FILE_EXTENSIONS: Record<string, string> = {
  css: 'css',
  scss: 'scss',
  json: 'json',
  javascript: 'js',
  swift: 'swift',
  kotlin: 'kt',
} as const;

const ANIMATION_CONFIG = {
  backdrop: { duration: 0.2 },
  modal: { type: 'spring' as const, duration: 0.5 },
} as const;

const COPY_TIMEOUT_MS = 2000;

function ModalBackdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={ANIMATION_CONFIG.backdrop}
      onClick={onClick}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      aria-hidden="true"
    />
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <header className="flex items-center justify-between p-6 border-b border-(--border)">
      <div>
        <h2 className="text-xl font-semibold text-(--foreground)">{title}</h2>
        <p className="text-sm text-(--muted-foreground) mt-1">
          Copy or download your color palette
        </p>
      </div>
      <button
        onClick={onClose}
        className="p-2 hover:bg-(--muted) rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-soft-orange"
        aria-label="Close modal"
        type="button"
      >
        <X className="h-5 w-5 text-(--muted-foreground)" aria-hidden="true" />
      </button>
    </header>
  );
}

function ModalContent({ content }: { content: string }) {
  return (
    <div className="flex-1 overflow-auto p-6">
      <pre className="text-sm bg-(--muted) p-4 rounded-lg overflow-x-auto text-(--foreground) font-mono">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function ModalFooter({
  onDownload,
  onCopy,
  copied,
}: {
  onDownload: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <footer className="flex items-center justify-end gap-3 p-6 border-t border-(--border)">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onDownload}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--muted) hover:bg-(--muted)/80 text-(--foreground) transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-soft-orange"
        type="button"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onCopy}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-soft-orange hover:bg-soft-orange/90 text-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-soft-orange focus:ring-offset-2"
        type="button"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copy to Clipboard
          </>
        )}
      </motion.button>
    </footer>
  );
}

export default function ExportModal({
  isOpen,
  onClose,
  title,
  content,
  language = 'css',
}: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  const fileExtension = useMemo(() => {
    return FILE_EXTENSIONS[language] || 'txt';
  }, [language]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success(`Copied ${title}`);
      setTimeout(() => setCopied(false), COPY_TIMEOUT_MS);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
      console.error('Copy error:', error);
    }
  }, [content, title]);

  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `colors.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${title}`);
    } catch (error) {
      toast.error('Failed to download file');
      console.error('Download error:', error);
    }
  }, [content, title, fileExtension]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleModalClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <ModalBackdrop onClick={handleBackdropClick} />

          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={ANIMATION_CONFIG.modal}
              className="bg-(--card) rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col border border-(--border)"
              onClick={handleModalClick}
            >
              <ModalHeader title={title} onClose={onClose} />
              <ModalContent content={content} />
              <ModalFooter onDownload={handleDownload} onCopy={handleCopy} copied={copied} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
