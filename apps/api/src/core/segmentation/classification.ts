import type { SegmentResult } from '../../types/segmentation';

export const FOREGROUND_LABELS = new Set([
  'person',
  'bicycle',
  'car',
  'motorcycle',
  'airplane',
  'bus',
  'train',
  'truck',
  'boat',
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
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',
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
  'tree',
  'plant',
  'flower',
  'bush',
  'sculpture',
  'statue',
  'monument',
  'fountain',
]);

export const AMBIGUOUS_LABELS = new Set(['tree-merged', 'building-other-merged', 'wall', 'fence']);

export function classifySegment(
  label: string,
  score: number,
  allSegments: SegmentResult[]
): 'foreground' | 'background' | 'uncertain' {
  const lowerLabel = label.toLowerCase();

  // Definite foreground
  if (FOREGROUND_LABELS.has(lowerLabel)) {
    return 'foreground';
  }

  // Definite background
  if (
    lowerLabel.includes('sky') ||
    lowerLabel.includes('road') ||
    lowerLabel.includes('pavement') ||
    lowerLabel.includes('ground') ||
    lowerLabel.includes('grass-merged') ||
    lowerLabel.includes('sea')
  ) {
    return 'background';
  }

  // Ambiguous - use heuristics
  if (AMBIGUOUS_LABELS.has(lowerLabel)) {
    const segmentCount = allSegments.length;

    if (score > 0.95 && segmentCount > 3) {
      return 'uncertain';
    }

    return 'background';
  }

  return 'background';
}
