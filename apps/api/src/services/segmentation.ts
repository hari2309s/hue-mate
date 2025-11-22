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
]);

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
      console.log('   ✗ No segments returned from Mask2Former');
      return null;
    }

    console.log(`   ✓ Received ${segments.length} segments from Mask2Former`);

    // Get image dimensions
    const { width, height } = await sharp(imageBuffer).metadata();
    if (!width || !height) {
      console.log('   ✗ Could not get image dimensions');
      return null;
    }

    // Create combined foreground mask
    const maskArray = new Uint8Array(width * height);

    for (const segment of segments) {
      const isForeground = FOREGROUND_LABELS.has(segment.label.toLowerCase());

      if (isForeground && segment.mask) {
        try {
          const maskBuffer = Buffer.from(segment.mask, 'base64');
          const { data: segmentMaskData } = await sharp(maskBuffer)
            .resize(width, height, { fit: 'fill' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

          // OR operation - combine masks
          for (let i = 0; i < maskArray.length && i < segmentMaskData.length; i++) {
            if (segmentMaskData[i] > 128) {
              maskArray[i] = 255;
            }
          }

          console.log(
            `   ✓ Added foreground segment: ${segment.label} (score: ${segment.score.toFixed(2)})`
          );
        } catch {
          console.log(`   ⚠ Failed to process mask for ${segment.label}`);
        }
      }
    }

    // Calculate foreground percentage
    let foregroundPixels = 0;
    for (let i = 0; i < maskArray.length; i++) {
      if (maskArray[i] > 128) foregroundPixels++;
    }
    const foreground_percentage = (foregroundPixels / maskArray.length) * 100;

    // Convert to PNG buffer
    const finalMaskBuffer = await sharp(Buffer.from(maskArray), {
      raw: { width, height, channels: 1 },
    })
      .png()
      .toBuffer();

    console.log(`   ✓ Foreground: ${foreground_percentage.toFixed(1)}%`);

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
    console.log('   → Calling SegFormer for semantic segmentation...');

    const resizedBuffer = await sharp(imageBuffer)
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    const response = await fetch(`${HF_API_URL}/${SEGFORMER_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/octet-stream',
      },
      body: resizedBuffer,
    });

    if (!response.ok) {
      if (response.status === 503) {
        console.log('   → Model loading, waiting 20 seconds...');
        await new Promise((r) => setTimeout(r, 20000));
        return segmentSemantic(imageBuffer);
      }
      console.log(`   ✗ SegFormer failed with status ${response.status}`);
      return [];
    }

    const results = (await response.json()) as SegmentResult[];
    console.log(`   ✓ Found ${results.length} semantic regions`);
    return results;
  } catch (error) {
    console.log(
      `   ✗ SegFormer segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
// SPLIT PIXELS BY LUMINANCE (fallback)
// ============================================

export function splitPixelsByLuminance(pixels: PixelData[]): {
  foreground: PixelData[];
  background: PixelData[];
} {
  const pixelsWithLum = pixels.map((p) => ({
    ...p,
    lum: 0.299 * p.r + 0.587 * p.g + 0.114 * p.b,
  }));

  pixelsWithLum.sort((a, b) => b.lum - a.lum);

  const splitPoint = Math.floor(pixels.length * 0.4);

  return {
    foreground: pixelsWithLum.slice(0, splitPoint).map(({ r, g, b }) => ({ r, g, b })),
    background: pixelsWithLum.slice(splitPoint).map(({ r, g, b }) => ({ r, g, b })),
  };
}
