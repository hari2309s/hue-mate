'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { ColorPaletteResult, ExtractedColor } from '@hue-und-you/types';
import ExtractionMetadata from '@/src/components/ExtractionMetadata';
import ExportButtons from '@/src/components/ExportButtons';

interface ColorPaletteDisplayProps {
  result: ColorPaletteResult;
}

interface ColorCardProps {
  color: ExtractedColor;
  index: number;
}

const ColorCard = ({ color, index }: ColorCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`Copied ${label}`);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatEntries = [
    { label: 'HEX', value: color.formats.hex },
    { label: 'RGB', value: color.formats.rgb.css },
    { label: 'HSL', value: color.formats.hsl.css },
    { label: 'OKLCH', value: color.formats.oklch.css },
  ];

  const getTemperatureBadgeClasses = (temp: string) => {
    switch (temp) {
      case 'warm':
        return 'bg-orange-500 text-white';
      case 'cool':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getContrastBadgeClasses = (passes: boolean) => {
    return passes ? 'bg-green-600 text-white' : 'bg-red-600 text-white';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-md border border-var(--border) bg-var(--card) overflow-hidden"
    >
      {/* Color swatch */}
      <div
        className="h-24 w-full relative group cursor-pointer"
        style={{ backgroundColor: color.formats.hex }}
        onClick={() => copyToClipboard(color.formats.hex, 'HEX')}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          {copied === 'HEX' ? (
            <Check className="h-6 w-6 text-white" />
          ) : (
            <Copy className="h-6 w-6 text-white" />
          )}
        </div>
      </div>

      {/* Color info */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-var(--foreground)">{color.name}</h3>
          <div className="flex gap-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-sm font-medium ${getTemperatureBadgeClasses(color.metadata.temperature)}`}
            >
              {color.metadata.temperature}
            </span>
          </div>
        </div>

        <p className="text-sm text-var(--muted-foreground) mb-3">{color.formats.hex}</p>

        {/* Format values */}
        <div className="space-y-1 mb-3">
          {formatEntries.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => copyToClipboard(value, label)}
              className="w-full flex items-center justify-between text-xs p-1.5 rounded hover:bg-var(--muted) transition-colors group"
            >
              <span className="text-var(--muted-foreground)">{label}</span>
              <span className="font-mono text-var(--foreground) flex items-center gap-1">
                {value.length > 25 ? value.slice(0, 25) + '...' : value}
                {copied === label ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Accessibility badge */}
        <div className="flex items-center gap-2 text-xs mb-3">
          <span className="text-var(--muted-foreground)">Contrast on white:</span>
          <span
            className={`px-1.5 py-0.5 rounded font-medium ${getContrastBadgeClasses(color.accessibility.contrast_on_white.wcag_aa_normal)}`}
          >
            {color.accessibility.contrast_on_white.ratio}:1
          </span>
        </div>

        {/* Expand/collapse tints & shades */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-xs text-var(--muted-foreground) hover:text-var(--foreground) transition-colors cursor-pointer"
        >
          {expanded ? 'Show less' : 'Show tints & shades'}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Tints & Shades */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2">
                <div>
                  <p className="text-xs text-var(--muted-foreground) mb-1">Tints</p>
                  <div className="flex gap-1">
                    {color.tints.map((tint) => (
                      <button
                        key={tint.level}
                        onClick={() => copyToClipboard(tint.hex, `Tint${tint.level}`)}
                        className="flex-1 h-6 rounded transition-transform hover:scale-110"
                        style={{ backgroundColor: tint.hex }}
                        title={tint.hex}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-var(--muted-foreground) mb-1">Shades</p>
                  <div className="flex gap-1">
                    {color.shades.map((shade) => (
                      <button
                        key={shade.level}
                        onClick={() => copyToClipboard(shade.hex, `Shade ${shade.level}`)}
                        className="flex-1 h-6 rounded transition-transform hover:scale-110"
                        style={{ backgroundColor: shade.hex }}
                        title={shade.hex}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const ColorPaletteDisplay = ({ result }: ColorPaletteDisplayProps) => {
  return (
    <div className="w-full max-w-5xl mx-auto mt-8 space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
        {/* Extraction Metadata */}
        <ExtractionMetadata metadata={result.metadata} showWarning={true} />

        {/* Export Buttons */}
        <ExportButtons exports={result.exports} />
      </div>

      {/* Color grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {result.palette.map((color, index) => (
          <ColorCard key={color.id} color={color} index={index} />
        ))}
      </div>
    </div>
  );
};
export default ColorPaletteDisplay;
