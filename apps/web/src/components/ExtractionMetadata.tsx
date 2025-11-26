'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Palette,
  Thermometer,
  Sparkles,
  AlertCircle,
  Layers,
  TrendingUp,
} from 'lucide-react';
import type { ExtractionMetadata } from '@hue-und-you/types';

interface ExtractionMetadataProps {
  metadata: ExtractionMetadata;
  showWarning?: boolean;
}

interface MetadataItem {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

const ANIMATION_CONFIG = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
} as const;

const QUALITY_BADGE_CLASSES = {
  high: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  low: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
} as const;

const DIVERSITY_THRESHOLDS = {
  VERY_HIGH: 0.75,
  HIGH: 0.5,
  MODERATE: 0.3,
} as const;

const SATURATION_COLORS = {
  VERY_HIGH: 'text-purple-500',
  HIGH: 'text-blue-500',
  MODERATE: 'text-slate-500',
  LOW: 'text-gray-500',
} as const;

const CONFIDENCE_COLORS = {
  HIGH: 'text-green-500',
  MEDIUM: 'text-yellow-500',
  LOW: 'text-orange-500',
} as const;

function getDiversityLabel(diversity: number): string {
  if (diversity >= DIVERSITY_THRESHOLDS.VERY_HIGH) return 'Very High';
  if (diversity >= DIVERSITY_THRESHOLDS.HIGH) return 'High';
  if (diversity >= DIVERSITY_THRESHOLDS.MODERATE) return 'Moderate';
  return 'Low';
}

function getDiversityColor(diversity: number): string {
  if (diversity >= DIVERSITY_THRESHOLDS.VERY_HIGH) return CONFIDENCE_COLORS.HIGH;
  if (diversity >= DIVERSITY_THRESHOLDS.HIGH) return 'text-emerald-500';
  if (diversity >= DIVERSITY_THRESHOLDS.MODERATE) return CONFIDENCE_COLORS.MEDIUM;
  return CONFIDENCE_COLORS.LOW;
}

function getSaturationColor(saturation: number): string {
  if (saturation >= 65) return SATURATION_COLORS.VERY_HIGH;
  if (saturation >= 45) return SATURATION_COLORS.HIGH;
  if (saturation >= 25) return SATURATION_COLORS.MODERATE;
  return SATURATION_COLORS.LOW;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return CONFIDENCE_COLORS.HIGH;
  if (confidence >= 0.6) return CONFIDENCE_COLORS.MEDIUM;
  return CONFIDENCE_COLORS.LOW;
}

function getTemperatureEmoji(temperature: string): string {
  switch (temperature) {
    case 'warm':
      return '🔥';
    case 'cool':
      return '❄️';
    case 'neutral':
      return '⚖️';
    default:
      return '';
  }
}

function MetadataRow({ icon, label, value }: MetadataItem) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1">
        {typeof value === 'string' ? (
          <span className="text-(--foreground)">
            {label}: {value}
          </span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function WarningMessage({
  icon,
  message,
  color,
}: {
  icon: React.ReactNode;
  message: string;
  color: string;
}) {
  return (
    <div className={`flex items-start gap-3 text-sm rounded-md ${color} p-3`}>
      <div className="shrink-0 mt-0.5">{icon}</div>
      <span>{message}</span>
    </div>
  );
}

export default function ExtractionMetadata({
  metadata,
  showWarning = false,
}: ExtractionMetadataProps) {
  const processingSeconds = useMemo(
    () => (metadata.processingTimeMs / 1000).toFixed(2),
    [metadata.processingTimeMs]
  );

  const algorithmLabel = useMemo(
    () => (metadata.algorithm === 'weighted-kmeans' ? 'Weighted K-means++' : 'K-means++'),
    [metadata.algorithm]
  );

  const diversityLabel = useMemo(
    () => getDiversityLabel(metadata.colorDiversity),
    [metadata.colorDiversity]
  );

  const diversityColor = useMemo(
    () => getDiversityColor(metadata.colorDiversity),
    [metadata.colorDiversity]
  );

  const saturationColor = useMemo(
    () => getSaturationColor(metadata.averageSaturation),
    [metadata.averageSaturation]
  );

  const confidenceColor = useMemo(
    () => getConfidenceColor(metadata.extractionConfidence.overall),
    [metadata.extractionConfidence.overall]
  );

  const temperatureEmoji = useMemo(
    () => getTemperatureEmoji(metadata.dominantTemperature),
    [metadata.dominantTemperature]
  );

  const showLowQualityWarning =
    showWarning &&
    (metadata.segmentationQuality.usedFallback ||
      metadata.averageSaturation < 25 ||
      metadata.colorDiversity < 0.3 ||
      metadata.extractionConfidence.overall < 0.7);

  return (
    <motion.section
      initial={ANIMATION_CONFIG.initial}
      animate={ANIMATION_CONFIG.animate}
      transition={ANIMATION_CONFIG.transition}
      className="w-full rounded-md border border-(--border) bg-(--card) p-5 space-y-3"
      aria-label="Extraction metadata"
    >
      {/* Processing Time */}
      <MetadataRow
        icon={<Clock className="h-5 w-5 text-soft-orange" aria-hidden="true" />}
        label="Processing time"
        value={
          <span className="text-(--foreground)">
            Extracted in <strong>{processingSeconds}s</strong> using{' '}
            <strong>{algorithmLabel}</strong>
          </span>
        }
      />

      {/* Segmentation Quality */}
      <MetadataRow
        icon={<Layers className="h-5 w-5 text-soft-orange" aria-hidden="true" />}
        label="Segmentation"
        value={
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-(--foreground)">Segmentation:</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium border ${QUALITY_BADGE_CLASSES[metadata.segmentationQuality.confidence]}`}
            >
              {metadata.segmentationQuality.confidence.toUpperCase()}
            </span>
            <span className="text-(--muted-foreground) text-xs">
              (
              {metadata.segmentationQuality.method === 'mask2former'
                ? 'AI Model'
                : 'Fallback Method'}
              )
            </span>
          </div>
        }
      />

      {/* Overall Extraction Confidence */}
      <MetadataRow
        icon={<TrendingUp className="h-5 w-5 text-soft-orange" aria-hidden="true" />}
        label="Extraction confidence"
        value={
          <span className="text-(--foreground)">
            Extraction Confidence:{' '}
            <strong className={confidenceColor}>
              {Math.round(metadata.extractionConfidence.overall * 100)}%
            </strong>
            <span className="text-(--muted-foreground) text-xs ml-2">
              (separation: {Math.round(metadata.extractionConfidence.colorSeparation * 100)}%,
              naming: {Math.round(metadata.extractionConfidence.namingQuality * 100)}%)
            </span>
          </span>
        }
      />

      {/* Color Diversity */}
      <MetadataRow
        icon={<Palette className="h-5 w-5 text-soft-orange" aria-hidden="true" />}
        label="Color diversity"
        value={
          <span className="text-(--foreground)">
            Color Diversity: <strong className={diversityColor}>{diversityLabel}</strong>
            <span className="text-(--muted-foreground)">
              {' '}
              ({metadata.colorDiversity.toFixed(2)})
            </span>
          </span>
        }
      />

      {/* Average Saturation */}
      <MetadataRow
        icon={
          <div className={`h-5 w-5 ${saturationColor}`}>
            <svg
              className="h-full w-full"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
          </div>
        }
        label="Average saturation"
        value={
          <span className="text-(--foreground)">
            Average Saturation:{' '}
            <strong className={saturationColor}>{metadata.averageSaturation}%</strong>
          </span>
        }
      />

      {/* Temperature */}
      <MetadataRow
        icon={<Thermometer className="h-5 w-5 text-soft-orange" aria-hidden="true" />}
        label="Dominant tone"
        value={
          <span className="text-(--foreground)">
            Dominant Tone: <strong className="capitalize">{metadata.dominantTemperature}</strong>{' '}
            {temperatureEmoji}
          </span>
        }
      />

      {/* Suggested Usage */}
      <div className="flex items-start gap-3 text-sm rounded-md bg-(--muted) p-3">
        <Sparkles className="h-5 w-5 text-soft-orange shrink-0 mt-0.5" aria-hidden="true" />
        <span className="text-(--foreground)">{metadata.suggestedUsage}</span>
      </div>

      {/* Warnings */}
      {showLowQualityWarning && (
        <div className="space-y-2 pt-2">
          {metadata.segmentationQuality.usedFallback && (
            <WarningMessage
              icon={<AlertCircle className="h-5 w-5 text-blue-600" aria-hidden="true" />}
              message="AI segmentation unavailable. Used fallback method for foreground/background separation. Results may be less accurate."
              color="bg-blue-500/10 border border-blue-500/20 text-blue-700"
            />
          )}

          {(metadata.averageSaturation < 25 || metadata.colorDiversity < 0.3) && (
            <WarningMessage
              icon={<AlertCircle className="h-5 w-5 text-yellow-600" aria-hidden="true" />}
              message={
                metadata.averageSaturation < 25 && metadata.colorDiversity < 0.3
                  ? 'Image has low color saturation and diversity. Try images with more vibrant, varied colors.'
                  : metadata.averageSaturation < 25
                    ? 'Image has low color saturation. Consider images with more vibrant colors.'
                    : 'Color diversity is low. Multiple extracted colors may be similar.'
              }
              color="bg-yellow-500/10 border border-yellow-500/20 text-yellow-700"
            />
          )}

          {metadata.extractionConfidence.overall < 0.7 && (
            <WarningMessage
              icon={<AlertCircle className="h-5 w-5 text-orange-600" aria-hidden="true" />}
              message="Extraction confidence is moderate. Colors may not be as accurately separated or named as expected."
              color="bg-orange-500/10 border border-orange-500/20 text-orange-700"
            />
          )}
        </div>
      )}
    </motion.section>
  );
}
