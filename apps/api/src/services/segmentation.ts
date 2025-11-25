import sharp from 'sharp';
import type {
  ForegroundMask,
  SegmentResult,
  ExtractedPixels,
  PixelData,
} from '../types/segmentation';

const HF_API_URL = 'https://router.huggingface.co/hf-inference/models';
const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;

// Models
const MASK2FORMER_MODEL = 'facebook/mask2former-swin-base-coco-panoptic';
const SEGFORMER_MODEL = 'nvidia/segformer-b0-finetuned-ade-512-512';

// COCO panoptic "thing" classes (foreground objects)
const FOREGROUND_LABELS = new Set([
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

const AMBIGUOUS_LABELS = new Set(['tree-merged', 'building-other-merged', 'wall', 'fence']);

function classifySegment(
  label: string,
  score: number,
  allSegments: SegmentResult[]
): 'foreground' | 'background' | 'uncertain' {
  const lowerLabel = label.toLowerCase();

  // Definite foreground
  if (FOREGROUND_LABELS.has(lowerLabel)) {
    return 'foreground';
  }

  // Definite background (sky, road, etc.)
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
    // If this is a high-confidence, small segment, it might be foreground
    // (e.g., a featured tree or building facade)
    const segmentCount = allSegments.length;

    if (score > 0.95 && segmentCount > 3) {
      // Likely a distinct foreground element
      return 'uncertain'; // Let the caller decide
    }

    return 'background';
  }

  // Unknown label - conservative approach
  return 'background';
}

// ============================================
// FOREGROUND/BACKGROUND SEGMENTATION
// Using facebook/mask2former-swin-base-coco-panoptic
// ============================================

export async function segmentForegroundBackground(
  imageBuffer: Buffer
): Promise<ForegroundMask | null> {
  try {
    console.log('   → Calling Mask2Former for foreground/background separation...');

    const response = await fetch(`${HF_API_URL}/${MASK2FORMER_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
    });

    if (!response.ok) {
      if (response.status === 503) {
        console.log('   → Model loading, waiting 20 seconds...');
        await new Promise((r) => setTimeout(r, 20000));
        return segmentForegroundBackground(imageBuffer);
      }
      const errorText = await response.text();
      console.log(`   ✗ Mask2Former failed with status ${response.status}: ${errorText}`);
      return null;
    }

    const segments = (await response.json()) as SegmentResult[];

    if (!Array.isArray(segments) || segments.length === 0) {
      return null;
    }

    console.log(`   ✓ Received ${segments.length} segments from Mask2Former`);

    const { width, height } = await sharp(imageBuffer).metadata();
    if (!width || !height) {
      return null;
    }

    const maskArray = new Uint8Array(width * height);
    let foregroundSegmentCount = 0;

    for (const segment of segments) {
      const classification = classifySegment(segment.label, segment.score, segments);

      // Use both definite foreground and uncertain segments
      if ((classification === 'foreground' || classification === 'uncertain') && segment.mask) {
        try {
          const maskBuffer = Buffer.from(segment.mask, 'base64');
          const { data: segmentMaskData } = await sharp(maskBuffer)
            .resize(width, height, { fit: 'fill' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

          for (let i = 0; i < maskArray.length && i < segmentMaskData.length; i++) {
            if (segmentMaskData[i] > 128) {
              maskArray[i] = 255;
            }
          }

          foregroundSegmentCount++;
          console.log(
            `   ✓ Added ${classification} segment: ${segment.label} (score: ${segment.score.toFixed(2)})`
          );
        } catch {
          console.log(`   ⚠ Failed to process mask for ${segment.label}`);
        }
      }
    }

    if (foregroundSegmentCount === 0) {
      console.log('   ⚠ No foreground segments identified');
      return null;
    }

    let foregroundPixels = 0;
    for (let i = 0; i < maskArray.length; i++) {
      if (maskArray[i] > 128) foregroundPixels++;
    }
    const foreground_percentage = (foregroundPixels / maskArray.length) * 100;

    // IMPROVED: More flexible thresholds
    // - Allow very small foreground (architectural details, distant objects)
    // - Only reject if literally no foreground or completely dominant
    if (foreground_percentage > 95 && foreground_percentage <= 99.5) {
      console.log(
        `   ℹ Large foreground detected (${foreground_percentage.toFixed(1)}%) - may be close-up or portrait`
      );
    }

    const finalMaskBuffer = await sharp(Buffer.from(maskArray), {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();

    console.log(`   ✓ Foreground: ${foreground_percentage.toFixed(1)}%`);
    console.log(
      `   → Detected segments: ${segments.map((s) => `${s.label}(${s.score.toFixed(2)})`).join(', ')}`
    );

    return { mask: finalMaskBuffer, foreground_percentage };
  } catch (error) {
    console.log(
      `   ✗ Mask2Former segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return null;
  }
}

// ============================================
// SEMANTIC SEGMENTATION
// Using nvidia/segformer-b0-finetuned-ade-512-512
// ============================================

export async function segmentSemantic(imageBuffer: Buffer): Promise<SegmentResult[]> {
  try {
    console.log('🔍 === SEMANTIC SEGMENTATION DEBUG START ===');
    console.log('   → API URL:', `${HF_API_URL}/${SEGFORMER_MODEL}`);
    console.log('   → Original image buffer size:', imageBuffer.length, 'bytes');
    console.log('   → HF Token present:', !!HF_TOKEN);

    if (!HF_TOKEN) {
      console.log('   ✗ CRITICAL: HF_TOKEN is not set!');
      return [];
    }

    console.log('   → Calling SegFormer for semantic segmentation...');
    console.log('   → Resizing image to 640x640...');

    const resizedBuffer = await sharp(imageBuffer)
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    console.log('   → Resized buffer size:', resizedBuffer.length, 'bytes');
    const requestStart = Date.now();

    const response = await fetch(`${HF_API_URL}/${SEGFORMER_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: resizedBuffer,
    });

    const requestDuration = Date.now() - requestStart;
    console.log(`   → Request completed in ${requestDuration}ms`);
    console.log('   → Response status:', response.status);
    console.log('   → Response status text:', response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('   ✗ Response NOT OK');
      console.log('   ✗ Response body:', errorText);

      if (response.status === 503) {
        console.log('   → Model loading (503 status), waiting 20 seconds...');
        await new Promise((r) => setTimeout(r, 20000));
        console.log('   → Retrying after model load wait...');
        return segmentSemantic(imageBuffer);
      }

      if (response.status === 401 || response.status === 403) {
        console.log('   ✗ AUTHENTICATION ERROR - Check your HuggingFace API token');
      }

      console.log(`   ✗ SegFormer failed with status ${response.status}`);
      console.log('🔍 === SEMANTIC SEGMENTATION DEBUG END ===\n');
      return [];
    }

    console.log('   → Response OK, parsing JSON...');
    const responseText = await response.text();
    console.log('   → Raw response text (first 300 chars):', responseText.substring(0, 300));

    let results: SegmentResult[];
    try {
      results = JSON.parse(responseText) as SegmentResult[];
      console.log('   ✓ Successfully parsed JSON response');
      console.log('   → Response type:', typeof results);
      console.log('   → Is array:', Array.isArray(results));
    } catch (parseError) {
      console.log('   ✗ JSON PARSE ERROR');
      console.log('   → Error:', parseError);
      console.log('   → Full response text:', responseText);
      console.log('🔍 === SEMANTIC SEGMENTATION DEBUG END ===\n');
      return [];
    }

    console.log(`   ✓ Found ${results.length} semantic regions`);
    if (results.length > 0) {
      console.log('   → Region details:');
      results.forEach((r, idx) => {
        console.log(`      [${idx}] label: "${r.label}", score: ${r.score?.toFixed(3) || 'N/A'}`);
      });
    }
    console.log('🔍 === SEMANTIC SEGMENTATION DEBUG END ===\n');

    return results;
  } catch (error) {
    console.log('🔍 === SEMANTIC SEGMENTATION DEBUG - CAUGHT ERROR ===');
    console.log('   ✗ Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.log('   ✗ Error message:', error instanceof Error ? error.message : String(error));
    console.log('   ✗ Error stack:', error instanceof Error ? error.stack : 'N/A');

    // Check for specific error types
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('   ✗ NETWORK ERROR - Check internet connection and API URL');
    }

    console.log(
      `   ✗ SegFormer segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    console.log('🔍 === SEMANTIC SEGMENTATION DEBUG END ===\n');
    return [];
  }
}

// ============================================
// PIXEL EXTRACTION
// ============================================

export async function extractPixels(
  imageBuffer: Buffer,
  foregroundMask: ForegroundMask | null,
  _options: { logFallback?: boolean } = {}
): Promise<ExtractedPixels> {
  const pixels: PixelData[] = [];
  const isForeground: boolean[] = [];

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  console.log(`   ✓ Image dimensions: ${metadata.width}x${metadata.height}`);

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  let maskData: Buffer | null = null;
  if (foregroundMask) {
    maskData = await sharp(foregroundMask.mask)
      .resize(info.width, info.height, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();
  }

  const totalPixels = info.width * info.height;
  const maxSamples = 5000;
  const sampleRate = Math.max(1, Math.floor(totalPixels / maxSamples));

  console.log(`   ✓ Sampling every ${sampleRate} pixel(s) from ${totalPixels} total`);

  for (let i = 0; i < data.length; i += sampleRate * info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const brightness = (r + g + b) / 3;
    if (brightness > 15 && brightness < 240) {
      pixels.push({ r, g, b });

      if (maskData) {
        const maskIndex = Math.floor(i / info.channels);
        isForeground.push(maskData[maskIndex] > 128);
      } else {
        isForeground.push(true);
      }
    }
  }

  return { pixels, isForeground };
}

// ============================================
// SPLIT PIXELS BY SATURATION (IMPROVED FALLBACK)
// ============================================

export function splitPixelsByLuminance(
  pixels: PixelData[],
  splitRatio: number = 0.3
): {
  foreground: PixelData[];
  background: PixelData[];
} {
  // Use saturation primarily - foreground objects are typically more saturated
  const pixelsWithScore = pixels.map((p) => {
    const max = Math.max(p.r, p.g, p.b);
    const min = Math.min(p.r, p.g, p.b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;

    return {
      ...p,
      sat,
      lum,
      // Combine saturation and luminance variance for better split
      score: sat * 0.7 + (Math.abs(lum - 128) / 255) * 0.3,
    };
  });

  // Sort by combined score (high saturation + varied luminance = likely foreground)
  pixelsWithScore.sort((a, b) => b.score - a.score);

  const splitPoint = Math.floor(pixels.length * splitRatio);

  return {
    foreground: pixelsWithScore.slice(0, splitPoint).map(({ r, g, b }) => ({ r, g, b })),
    background: pixelsWithScore.slice(splitPoint).map(({ r, g, b }) => ({ r, g, b })),
  };
}
