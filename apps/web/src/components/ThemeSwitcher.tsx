'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Monitor } from 'lucide-react';

const themes = ['light', 'dark', 'system'] as const;
type Theme = (typeof themes)[number];

const iconVariants = {
  initial: { scale: 0, rotate: -180, opacity: 0 },
  animate: { scale: 1, rotate: 0, opacity: 1 },
  exit: { scale: 0, rotate: 180, opacity: 0 },
};

const emptySubscribe = () => () => {};

const ThemeSwitcher = () => {
  const isServer = useSyncExternalStore(
    emptySubscribe,
    () => false,
    () => true
  );

  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme as Theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const renderIcon = () => {
    const iconClass = 'h-5 w-5 text-[var(--foreground)]';

    if (isServer) {
      return <div className="h-5 w-5" />;
    }

    switch (theme) {
      case 'light':
        return <Sun className={iconClass} />;
      case 'dark':
        return <Moon className={iconClass} />;
      case 'system':
      default:
        return <Monitor className={iconClass} />;
    }
  };

  return (
    <motion.button
      onClick={cycleTheme}
      className="fixed top-5 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-md bg-var(--card) shadow-lg border border-var(--border) cursor-pointer overflow-hidden"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: 1, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      aria-label={
        isServer
          ? 'Current theme: system. Click to switch theme.'
          : `Current theme: ${theme}. Click to switch theme.`
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isServer ? 'server' : theme}
          variants={iconVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {renderIcon()}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
};

export default ThemeSwitcher;
