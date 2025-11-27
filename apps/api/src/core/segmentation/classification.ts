import type { SegmentResult } from '../../types/segmentation';

export const FOREGROUND_LABELS = new Set([
  // People & Animals
  'person',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',

  // Vehicles
  'bicycle',
  'car',
  'motorcycle',
  'airplane',
  'bus',
  'train',
  'truck',
  'boat',

  // Accessories & Personal Items
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',

  // Sports & Recreation
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',

  // Food & Dining
  'bottle',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',

  // Furniture & Objects
  'chair',
  'couch',
  'potted plant',
  'bed',
  'dining table',
  'toilet',
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
  'stairs',
  'curtain',

  // Urban Elements
  'traffic light',
  'fire hydrant',
  'stop sign',
  'parking meter',
  'bench',
  'street sign',
  'streetlight',
  'light',
  'tower',
  'pole',
  'post',
  'mailbox',
  'signboard',
  'banner',
  'flag',

  // Art & Decoration
  'sculpture',
  'statue',
  'monument',
  'fountain',

  // Nature Elements (for landscapes)
  'tree',
  'plant',
  'flower',
  'bush',
  'grass',
  'mountain',
  'hill',
  'rock',
  'water',
  'river',
  'lake',
  'waterfall',
  'forest',
  'wood',
  'log',
  'field',

  // Architecture (when they're the subject)
  'building',
  'house',
  'bridge',
  'fence',
]);

export const AMBIGUOUS_LABELS = new Set(['tree-merged', 'building-other-merged', 'wall', 'fence']);

export function classifySegment(
  label: string,
  score: number,
  allSegments: SegmentResult[]
): 'foreground' | 'background' | 'uncertain' {
  const lowerLabel = label.toLowerCase().replace(/-merged$/, '');

  // Definite foreground
  if (FOREGROUND_LABELS.has(lowerLabel)) {
    return 'foreground';
  }

  // Always background
  if (
    lowerLabel === 'sky' ||
    lowerLabel.includes('sky-other') ||
    lowerLabel === 'road' ||
    lowerLabel === 'pavement' ||
    lowerLabel === 'ground' ||
    lowerLabel === 'ceiling' ||
    lowerLabel === 'floor'
  ) {
    return 'background';
  }

  // Context-aware: If image has many segments, smaller segments are likely foreground
  if (allSegments.length >= 4) {
    // Sort by score to understand relative importance
    const sortedByScore = [...allSegments].sort((a, b) => b.score - a.score);
    const currentIndex = sortedByScore.findIndex(
      (s) => s.label.toLowerCase() === label.toLowerCase()
    );

    // If this segment is in top 3 by score and not explicitly background
    if (currentIndex >= 0 && currentIndex < 3 && score > 0.8) {
      return 'uncertain';
    }
  }

  // Ambiguous labels
  if (AMBIGUOUS_LABELS.has(lowerLabel)) {
    if (score > 0.95 && allSegments.length > 3) {
      return 'uncertain';
    }
    return 'background';
  }

  // Default: if high confidence, might be foreground
  if (score > 0.95) {
    return 'uncertain';
  }

  return 'background';
}
