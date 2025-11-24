import namer from 'color-namer';
import type { RGBValues } from '@hue-und-you/types';
import type { CategoryWithScore } from './colorNaming';
import { rgbToHex } from './colorConversion';
import {
  generateOllamaResponse,
  isOllamaAvailable as checkOllamaAvailable,
} from './ollamaCloudClient';

// Cache to avoid repeated calls
const contextCache = new Map<string, string>();

/**
 * Generate cache key
 */
function getCacheKey(rgb: RGBValues, baseName: string): string {
  const r = Math.round(rgb.r / 10) * 10;
  const g = Math.round(rgb.g / 10) * 10;
  const b = Math.round(rgb.b / 10) * 10;
  return `${r}-${g}-${b}-${baseName}`;
}

/**
 * Get human-readable color description
 */
function getColorDescription(rgb: RGBValues): string {
  const { r, g, b } = rgb;
  const brightness = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;

  let hue = '';
  if (saturation < 0.1) {
    if (brightness > 200) return 'white';
    if (brightness < 50) return 'black';
    return 'gray';
  }

  if (r > g && r > b) hue = 'red';
  else if (g > r && g > b) hue = 'green';
  else if (b > r && b > g) hue = 'blue';
  else if (r > b && g > b) hue = 'yellow';
  else if (r > g && b > g) hue = 'purple';
  else if (g > r && b > r) hue = 'cyan';

  if (brightness < 80) return `dark ${hue}`;
  if (brightness > 180) return `light ${hue}`;
  return hue;
}

/**
 * Get base color name from color-namer (for consistency)
 */
export function getBaseColorName(rgb: RGBValues): string {
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
  const names = namer(hex);
  const ntcName = names.ntc[0]?.name || '';
  const basicName = names.basic[0]?.name || '';
  const bestName = ntcName || basicName || 'Unknown';

  return bestName
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Ask Ollama to provide semantic prefix for a color
 */
export async function getSemanticPrefixFromOllama(
  imageBase64: string,
  rgb: RGBValues,
  baseName: string,
  categories: CategoryWithScore[]
): Promise<string | null> {
  const cacheKey = getCacheKey(rgb, baseName);

  if (contextCache.has(cacheKey)) {
    console.log(`   ✓ Cache hit for ${baseName}`);
    return contextCache.get(cacheKey)!;
  }

  try {
    const colorDesc = getColorDescription(rgb);
    const categoryList = categories
      .filter((c) => c.score > 0.05)
      .slice(0, 6)
      .map((c) => c.label)
      .join(', ');

    if (!categoryList) {
      console.log(`   ⚠ No categories available`);
      return null;
    }

    const prompt = `You are analyzing an image to name colors contextually.

I extracted a "${baseName}" color (${colorDesc}, RGB ${rgb.r},${rgb.g},${rgb.b}) from this image.

The image contains these scene elements: ${categoryList}

Based on what you see, what type of element does this color belong to?

Reply with ONE appropriate prefix:
- "Sky" if it represents sky/clouds/atmosphere
- "Forest" if it represents trees/foliage/woods
- "Ocean" or "Water" if it represents water/sea/lake/river
- "Alpine" if it represents mountains/rocks
- "Meadow" if it represents grass/field
- "Sand" if it represents sand/beach/desert
- "Frost" if it represents snow/ice
- "Leaf" if it represents plants/vegetation (not trees)
- Say "none" if the color doesn't clearly belong to any scene element

Reply with ONLY the prefix word:`;

    console.log(`   → Asking Ollama for semantic prefix of "${baseName}"...`);

    const response = await generateOllamaResponse({
      model: '', // Model is set in the client
      prompt,
      images: [imageBase64],
      options: {
        temperature: 0.1,
        num_predict: 5,
        top_k: 3,
        top_p: 0.3,
      },
    });

    if (!response) {
      console.log(`   ✗ Ollama request failed`);
      return null;
    }

    const answer = response.response.trim().toLowerCase();
    console.log(`   ✓ Ollama response: "${answer}"`);

    const validPrefixes = [
      'sky',
      'forest',
      'ocean',
      'water',
      'alpine',
      'meadow',
      'sand',
      'frost',
      'leaf',
    ];

    let matchedPrefix: string | null = null;
    for (const prefix of validPrefixes) {
      if (answer.includes(prefix)) {
        matchedPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        break;
      }
    }

    if (answer.includes('none') || answer.includes('no ') || !matchedPrefix) {
      console.log(`   → No clear semantic context, using base name only`);
      contextCache.set(cacheKey, 'none');
      return null;
    }

    console.log(`   ✓ Semantic prefix: ${matchedPrefix}`);
    contextCache.set(cacheKey, matchedPrefix);
    return matchedPrefix;
  } catch (error) {
    console.log(`   ✗ Ollama error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

/**
 * Get complete color name with semantic context
 */
export async function getContextualColorName(
  imageBase64: string,
  rgb: RGBValues,
  categories: CategoryWithScore[]
): Promise<{ name: string; category: string }> {
  const baseName = getBaseColorName(rgb);
  const prefix = await getSemanticPrefixFromOllama(imageBase64, rgb, baseName, categories);

  if (prefix) {
    return {
      name: `${prefix} ${baseName}`,
      category: prefix.toLowerCase(),
    };
  }

  return {
    name: baseName,
    category: 'general',
  };
}

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
  return checkOllamaAvailable();
}

/**
 * Clear the cache
 */
export function clearContextCache(): void {
  contextCache.clear();
  console.log('   ✓ Context cache cleared');
}
