'use client';

import { useState } from 'react';
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

const exportButtons: ExportButton[] = [
  {
    title: 'CSS Variables',
    icon: <FileCode className="h-4 w-4" />,
    language: 'css',
    getContent: (exports) => exports.css_variables,
    color: 'from-blue-500 to-blue-600',
  },
  {
    title: 'SCSS Variables',
    icon: <FileCode className="h-4 w-4" />,
    language: 'scss',
    getContent: (exports) => exports.scss_variables,
    color: 'from-pink-500 to-pink-600',
  },
  {
    title: 'Tailwind Config',
    icon: <Palette className="h-4 w-4" />,
    language: 'javascript',
    getContent: (exports) => JSON.stringify(exports.tailwind_config, null, 2),
    color: 'from-cyan-500 to-cyan-600',
  },
  {
    title: 'Figma Tokens',
    icon: <FileJson className="h-4 w-4" />,
    language: 'json',
    getContent: (exports) => JSON.stringify(exports.figma_tokens, null, 2),
    color: 'from-purple-500 to-purple-600',
  },

  // to be used later
  // {
  //   title: 'Swift',
  //   icon: <Smartphone className="h-4 w-4" />,
  //   language: 'swift',
  //   getContent: (exports) => exports.swift || '',
  //   color: 'from-orange-500 to-orange-600',
  // },
  // {
  //   title: 'Kotlin',
  //   icon: <Code2 className="h-4 w-4" />,
  //   language: 'kotlin',
  //   getContent: (exports) => exports.kotlin || '',
  //   color: 'from-violet-500 to-violet-600',
  // },
];

const ExportButtons = ({ exports }: ExportButtonsProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', content: '', language: '' });

  const openModal = (title: string, content: string, language: string) => {
    setModalContent({ title, content, language });
    setModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="rounded-md border border-var(--border) bg-var(--card) p-5"
      >
        <h3 className="text-lg font-semibold text-var(--foreground) mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-soft-orange" />
          Export Formats
        </h3>
        <p className="text-sm text-var(--muted-foreground) mb-4">
          Export your color palette in various formats for different platforms and tools.
        </p>
        <div className="flex flex-col gap-2">
          {exportButtons.map((button) => {
            const content = button.getContent(exports);
            if (!content) return null;

            return (
              <motion.button
                key={button.title}
                onClick={() => openModal(button.title, content, button.language)}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-soft-orange hover:bg-soft-orange/90 text-white font-medium text-sm shadow-md hover:shadow-lg transition-all text-left cursor-pointer"
              >
                <span>{button.icon}</span>
                <span className="flex-1">{button.title}</span>
                <span className="text-xs opacity-75">Click to view</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      <ExportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalContent.title}
        content={modalContent.content}
        language={modalContent.language}
      />
    </>
  );
};

export default ExportButtons;
