'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { ColorPaletteResult, ExtractedColor } from '@hute-mate/types';
import ExtractionMetadata from '@/src/components/ExtractionMetadata';
import ExportButtons from '@/src/components/ExportButtons';

interface ColorPaletteDisplayProps {
  result: ColorPaletteResult;
}

interface ColorCardProps {
  color: ExtractedColor;
  index: number;
}

interface FormatEntry {
  label: string;
  value: string;
}

const ANIMATION_CONFIG = {
  card: { delay: (index: number) => index * 0.1 },
  expansion: { duration: 0.2 },
} as const;

const TEMPERATURE_BADGE_CLASSES: Record<string, string> = {
  warm: 'bg-orange-500 text-white',
  cool: 'bg-blue-500 text-white',
  neutral: 'bg-gray-500 text-white',
} as const;

function getContrastBadgeClasses(passes: boolean): string {
  return passes ? 'bg-green-600 text-white' : 'bg-red-600 text-white';
}

function truncateValue(value: string, maxLength: number = 25): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function FormatButton({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      onClick={onCopy}
      className="w-full flex items-center justify-between text-xs p-1.5 rounded hover:bg-(--muted) transition-colors group"
      type="button"
    >
      <span className="text-(--muted-foreground)">{label}</span>
      <span className="font-mono text-(--foreground) flex items-center gap-1">
        {truncateValue(value)}
        {copied ? (
          <Check className="h-3 w-3 text-green-500" aria-label="Copied" />
        ) : (
          <Copy
            className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
}

function TintShadeRow({
  items,
  label,
  onCopy,
}: {
  items: Array<{ level: number; hex: string; name: string }>;
  label: string;
  onCopy: (hex: string, name: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-(--muted-foreground) mb-1">{label}</p>
      <div className="flex gap-1">
        {items.map((item) => (
          <button
            key={item.level}
            onClick={() => onCopy(item.hex, item.name)}
            className="flex-1 h-6 rounded transition-transform hover:scale-110 focus:scale-110 focus:outline-none focus:ring-2 focus:ring-soft-orange"
            style={{ backgroundColor: item.hex }}
            title={`${item.hex} - ${item.name}`}
            type="button"
            aria-label={`Copy ${item.name}`}
          />
        ))}
      </div>
    </div>
  );
}

function ColorCard({ color, index }: ColorCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`Copied ${label}`);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
      console.error('Copy error:', error);
    }
  }, []);

  const formatEntries: FormatEntry[] = useMemo(
    () => [
      { label: 'HEX', value: color.formats.hex },
      { label: 'RGB', value: color.formats.rgb.css },
      { label: 'HSL', value: color.formats.hsl.css },
      { label: 'OKLCH', value: color.formats.oklch.css },
    ],
    [color.formats]
  );

  const temperatureBadgeClass =
    TEMPERATURE_BADGE_CLASSES[color.metadata.temperature] || TEMPERATURE_BADGE_CLASSES.neutral;
  const contrastBadgeClass = getContrastBadgeClasses(
    color.accessibility.contrast_on_white.wcag_aa_normal
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: ANIMATION_CONFIG.card.delay(index) }}
      className="rounded-md border border-(--border) bg-(--card) overflow-hidden"
    >
      {/* Color swatch */}
      <button
        className="h-24 w-full relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-soft-orange"
        style={{ backgroundColor: color.formats.hex }}
        onClick={() => copyToClipboard(color.formats.hex, 'HEX')}
        aria-label={`Copy ${color.name} hex code: ${color.formats.hex}`}
        type="button"
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity bg-black/20">
          {copied === 'HEX' ? (
            <Check className="h-6 w-6 text-white" aria-label="Copied" />
          ) : (
            <Copy className="h-6 w-6 text-white" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Color info */}
      <div className="p-4">
        <header className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-(--foreground)">{color.name}</h3>
          <span
            className={`text-xs px-2 py-0.5 rounded-sm font-medium ${temperatureBadgeClass}`}
            aria-label={`Temperature: ${color.metadata.temperature}`}
          >
            {color.metadata.temperature}
          </span>
        </header>

        <p className="text-sm text-(--muted-foreground) mb-3">{color.formats.hex}</p>

        {/* Format values */}
        <nav className="space-y-1 mb-3" aria-label="Color format options">
          {formatEntries.map(({ label, value }) => (
            <FormatButton
              key={label}
              label={label}
              value={value}
              copied={copied === label}
              onCopy={() => copyToClipboard(value, label)}
            />
          ))}
        </nav>

        {/* Accessibility badge */}
        <div className="flex items-center gap-2 text-xs mb-3">
          <span className="text-(--muted-foreground)">Contrast on white:</span>
          <span
            className={`px-1.5 py-0.5 rounded font-medium ${contrastBadgeClass}`}
            aria-label={`Contrast ratio: ${color.accessibility.contrast_on_white.ratio}:1`}
          >
            {color.accessibility.contrast_on_white.ratio}:1
          </span>
        </div>

        {/* Expand/collapse tints & shades */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-xs text-(--muted-foreground) hover:text-(--foreground) transition-colors cursor-pointer focus:outline-none focus:text-(--foreground)"
          aria-expanded={expanded}
          aria-controls={`tints-shades-${color.id}`}
          type="button"
        >
          {expanded ? 'Show less' : 'Show tints & shades'}
          {expanded ? (
            <ChevronUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          )}
        </button>

        {/* Tints & Shades */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              id={`tints-shades-${color.id}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={ANIMATION_CONFIG.expansion}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2">
                <TintShadeRow
                  items={color.tints}
                  label="Tints"
                  onCopy={(hex, name) => copyToClipboard(hex, name)}
                />
                <TintShadeRow
                  items={color.shades}
                  label="Shades"
                  onCopy={(hex, name) => copyToClipboard(hex, name)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

export default function ColorPaletteDisplay({ result }: ColorPaletteDisplayProps) {
  return (
    <div className="w-full max-w-5xl mx-auto mt-8 space-y-8">
      {/* Metadata and Export Section */}
      <section
        className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start"
        aria-label="Color palette metadata and export options"
      >
        <ExtractionMetadata metadata={result.metadata} showWarning={true} />
        <ExportButtons exports={result.exports} />
      </section>

      {/* Color grid */}
      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start"
        aria-label="Extracted color palette"
      >
        {result.palette.map((color, index) => (
          <ColorCard key={color.id} color={color} index={index} />
        ))}
      </section>
    </div>
  );
}
