'use client';

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

const ExtractionMetadata = ({ metadata, showWarning = false }: ExtractionMetadataProps) => {
  const getDiversityLabel = (diversity: number) => {
    if (diversity >= 0.75) return 'Very High';
    if (diversity >= 0.5) return 'High';
    if (diversity >= 0.3) return 'Moderate';
    return 'Low';
  };

  const getDiversityColor = (diversity: number) => {
    if (diversity >= 0.75) return 'text-green-500';
    if (diversity >= 0.5) return 'text-emerald-500';
    if (diversity >= 0.3) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getSaturationColor = (saturation: number) => {
    if (saturation >= 65) return 'text-purple-500';
    if (saturation >= 45) return 'text-blue-500';
    if (saturation >= 25) return 'text-slate-500';
    return 'text-gray-500';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getQualityBadge = (quality: 'high' | 'medium' | 'low') => {
    const colors = {
      high: 'bg-green-500/10 text-green-600 border-green-500/20',
      medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      low: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    };
    return colors[quality];
  };

  const processingSeconds = (metadata.processingTimeMs / 1000).toFixed(2);
  const algorithmLabel =
    metadata.algorithm === 'weighted-kmeans' ? 'Weighted K-means++' : 'K-means++';

  const segQuality = metadata.segmentationQuality;
  const confidence = metadata.extractionConfidence;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full rounded-md border border-var(--border) bg-var(--card) p-5 space-y-3"
    >
      {/* Processing Time */}
      <div className="flex items-center gap-3 text-sm">
        <Clock className="h-5 w-5 text-soft-orange shrink-0" />
        <span className="text-var(--foreground)">
          Extracted in <span className="font-semibold">{processingSeconds}s</span> using{' '}
          <span className="font-semibold">{algorithmLabel}</span>
        </span>
      </div>

      {/* Segmentation Quality */}
      <div className="flex items-center gap-3 text-sm">
        <Layers className="h-5 w-5 text-soft-orange shrink-0" />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-var(--foreground)">Segmentation:</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium border ${getQualityBadge(segQuality.confidence)}`}
          >
            {segQuality.confidence.toUpperCase()}
          </span>
          <span className="text-var(--muted-foreground) text-xs">
            ({segQuality.method === 'mask2former' ? 'AI Model' : 'Fallback Method'})
          </span>
        </div>
      </div>

      {/* Overall Extraction Confidence */}
      <div className="flex items-center gap-3 text-sm">
        <TrendingUp className="h-5 w-5 text-soft-orange shrink-0" />
        <span className="text-var(--foreground)">
          Extraction Confidence:{' '}
          <span className={`font-semibold ${getConfidenceColor(confidence.overall)}`}>
            {Math.round(confidence.overall * 100)}%
          </span>
          <span className="text-var(--muted-foreground) text-xs ml-2">
            (separation: {Math.round(confidence.colorSeparation * 100)}%, naming:{' '}
            {Math.round(confidence.namingQuality * 100)}%)
          </span>
        </span>
      </div>

      {/* Color Diversity */}
      <div className="flex items-center gap-3 text-sm">
        <Palette className="h-5 w-5 text-soft-orange shrink-0" />
        <span className="text-var(--foreground)">
          Color Diversity:{' '}
          <span className={`font-semibold ${getDiversityColor(metadata.colorDiversity)}`}>
            {getDiversityLabel(metadata.colorDiversity)}
          </span>
          <span className="text-var(--muted-foreground)">
            ({metadata.colorDiversity.toFixed(2)})
          </span>
        </span>
      </div>

      {/* Average Saturation */}
      <div className="flex items-center gap-3 text-sm">
        <div className={`h-5 w-5 shrink-0 ${getSaturationColor(metadata.averageSaturation)}`}>
          <svg className="h-full w-full" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
          </svg>
        </div>
        <span className="text-var(--foreground)">
          Average Saturation:{' '}
          <span className={`font-semibold ${getSaturationColor(metadata.averageSaturation)}`}>
            {metadata.averageSaturation}%
          </span>
        </span>
      </div>

      {/* Temperature */}
      <div className="flex items-center gap-3 text-sm">
        <Thermometer className="h-5 w-5 text-soft-orange shrink-0" />
        <span className="text-var(--foreground)">
          Dominant Tone:{' '}
          <span className="font-semibold capitalize">{metadata.dominantTemperature}</span>
          {metadata.dominantTemperature === 'warm' && ' 🔥'}
          {metadata.dominantTemperature === 'cool' && ' ❄️'}
          {metadata.dominantTemperature === 'neutral' && ' ⚖️'}
        </span>
      </div>

      {/* Suggested Usage */}
      <div className="flex items-start gap-3 text-sm rounded-md bg-var(--muted) p-3">
        <Sparkles className="h-5 w-5 text-soft-orange shrink-0 mt-0.5" />
        <span className="text-var(--foreground)">{metadata.suggestedUsage}</span>
      </div>

      {/* Warning for low quality or fallback methods */}
      {showWarning && (
        <>
          {segQuality.usedFallback && (
            <div className="flex items-start gap-3 text-sm rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <span className="text-blue-700">
                AI segmentation unavailable. Used fallback method for foreground/background
                separation. Results may be less accurate.
              </span>
            </div>
          )}

          {(metadata.averageSaturation < 25 || metadata.colorDiversity < 0.3) && (
            <div className="flex items-start gap-3 text-sm rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <span className="text-yellow-700">
                {metadata.averageSaturation < 25 && metadata.colorDiversity < 0.3
                  ? 'Image has low color saturation and diversity. Try images with more vibrant, varied colors.'
                  : metadata.averageSaturation < 25
                    ? 'Image has low color saturation. Consider images with more vibrant colors.'
                    : 'Color diversity is low. Multiple extracted colors may be similar.'}
              </span>
            </div>
          )}

          {confidence.overall < 0.7 && (
            <div className="flex items-start gap-3 text-sm rounded-md bg-orange-500/10 border border-orange-500/20 p-3">
              <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
              <span className="text-orange-700">
                Extraction confidence is moderate. Colors may not be as accurately separated or
                named as expected.
              </span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default ExtractionMetadata;
