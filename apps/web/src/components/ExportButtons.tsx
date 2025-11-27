'use client';

import { useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { FileCode, FileJson, Palette, Package } from 'lucide-react';
import type { ExportFormats } from '@hue-und-you/types';
import ExportModal from './ExportModal';

interface ExportButtonsProps {
  exports: ExportFormats;
}

interface ExportButton {
  title: string;
  icon: React.ReactNode;
  language: string;
  getContent: (exports: ExportFormats) => string;
  color: string;
}

const ANIMATION_CONFIG = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  button: { scale: 1.02, x: 4 },
} as const;

const EXPORT_BUTTONS: readonly ExportButton[] = [
  {
    title: 'CSS Variables',
    icon: <FileCode className="h-4 w-4" aria-hidden="true" />,
    language: 'css',
    getContent: (exports) => exports.css_variables,
    color: 'from-blue-500 to-blue-600',
  },
  {
    title: 'SCSS Variables',
    icon: <FileCode className="h-4 w-4" aria-hidden="true" />,
    language: 'scss',
    getContent: (exports) => exports.scss_variables,
    color: 'from-pink-500 to-pink-600',
  },
  {
    title: 'Tailwind Config',
    icon: <Palette className="h-4 w-4" aria-hidden="true" />,
    language: 'javascript',
    getContent: (exports) => JSON.stringify(exports.tailwind_config, null, 2),
    color: 'from-cyan-500 to-cyan-600',
  },
  {
    title: 'Figma Tokens',
    icon: <FileJson className="h-4 w-4" aria-hidden="true" />,
    language: 'json',
    getContent: (exports) => JSON.stringify(exports.figma_tokens, null, 2),
    color: 'from-purple-500 to-purple-600',
  },
] as const;

interface ModalState {
  isOpen: boolean;
  title: string;
  content: string;
  language: string;
}

const INITIAL_MODAL_STATE: ModalState = {
  isOpen: false,
  title: '',
  content: '',
  language: '',
};

const ExportButton = memo<{
  button: ExportButton;
  content: string;
  onClick: () => void;
}>(({ button, content, onClick }) => {
  if (!content) return null;

  return (
    <motion.button
      onClick={onClick}
      whileHover={ANIMATION_CONFIG.button}
      whileTap={{ scale: 0.98 }}
      className="flex items-center gap-3 px-4 py-3 rounded-lg bg-soft-orange hover:bg-soft-orange/90 text-white font-medium text-sm shadow-md hover:shadow-lg transition-all text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-soft-orange focus:ring-offset-2"
      type="button"
      aria-label={`View ${button.title}`}
    >
      <span aria-hidden="true">{button.icon}</span>
      <span className="flex-1">{button.title}</span>
      <span className="text-xs opacity-75">Click to view</span>
    </motion.button>
  );
});
ExportButton.displayName = 'ExportButton';

export default function ExportButtons({ exports }: ExportButtonsProps) {
  const [modalState, setModalState] = useState<ModalState>(INITIAL_MODAL_STATE);

  const openModal = useCallback((title: string, content: string, language: string) => {
    setModalState({ isOpen: true, title, content, language });
  }, []);

  const closeModal = useCallback(() => {
    setModalState(INITIAL_MODAL_STATE);
  }, []);

  const availableButtons = useMemo(() => {
    return EXPORT_BUTTONS.filter((button) => {
      try {
        const content = button.getContent(exports);
        return content && content.length > 0;
      } catch (err) {
        if (err instanceof Error) {
          console.error(`[ExportButtons] Error getting content for ${button.title}:`, err.message);
        }
        return false;
      }
    });
  }, [exports]);

  return (
    <>
      <motion.section
        initial={ANIMATION_CONFIG.initial}
        animate={ANIMATION_CONFIG.animate}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="rounded-md border border-(--border) bg-(--card) p-5"
        aria-label="Export formats"
      >
        <header className="mb-4">
          <h3 className="text-lg font-semibold text-(--foreground) flex items-center gap-2">
            <Package className="h-5 w-5 text-soft-orange" aria-hidden="true" />
            Export Formats
          </h3>
          <p className="text-sm text-(--muted-foreground) mt-1">
            Export your color palette in various formats for different platforms and tools.
          </p>
        </header>

        <nav className="flex flex-col gap-2" aria-label="Export format options">
          {availableButtons.map((button) => (
            <ExportButton
              key={button.title}
              button={button}
              content={button.getContent(exports)}
              onClick={() => openModal(button.title, button.getContent(exports), button.language)}
            />
          ))}
        </nav>
      </motion.section>

      <ExportModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        content={modalState.content}
        language={modalState.language}
      />
    </>
  );
}
