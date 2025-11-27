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

function isValidTheme(theme: string | undefined): theme is Theme {
  return themes.includes(theme as Theme);
}

const ThemeSwitcher = () => {
  const isServer = useSyncExternalStore(
    emptySubscribe,
    () => false,
    () => true
  );

  const { theme: rawTheme, setTheme } = useTheme();

  // Type-safe theme with proper fallback
  const theme: Theme = isValidTheme(rawTheme) ? rawTheme : 'system';

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const renderIcon = () => {
    const iconClass = 'h-5 w-5 text-[var(--foreground)]';

    if (isServer) {
      return <div className="h-5 w-5" aria-hidden="true" />;
    }

    switch (theme) {
      case 'light':
        return <Sun className={iconClass} aria-label="Light mode" />;
      case 'dark':
        return <Moon className={iconClass} aria-label="Dark mode" />;
      case 'system':
      default:
        return <Monitor className={iconClass} aria-label="System mode" />;
    }
  };

  const getThemeLabel = (themeValue: Theme): string => {
    const labels: Record<Theme, string> = {
      light: 'Light mode',
      dark: 'Dark mode',
      system: 'System mode',
    };
    return labels[themeValue];
  };

  const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];

  return (
    <motion.button
      onClick={cycleTheme}
      className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-md bg-(--card) shadow-lg border border-dashed border-(--border) cursor-pointer overflow-hidden"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      aria-label={
        isServer
          ? 'Switch theme. Currently: system mode. Click to change theme.'
          : `Switch theme. Currently: ${getThemeLabel(theme)}. Click to switch to ${getThemeLabel(nextTheme)}.`
      }
      type="button"
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
