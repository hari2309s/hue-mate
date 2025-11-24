import type { RGBValues } from '@hue-und-you/types';
import { rgbToHex } from './colorConversion';

const HF_API_URL = 'https://router.huggingface.co/hf-inference/models';
const HF_TOKEN = process.env.HUGGINGFACE_API_KEY;

const COLOR_NAMING_MODEL = 'google/gemma-2-2b-it';

interface GemmaResponse {
  generated_text: string;
}

/**
 * Call Gemma 2 2B IT via HuggingFace Inference API
 */
async function callGemma(prompt: string): Promise<string | null> {
  if (!HF_TOKEN) {
    console.log('   ⚠ HUGGINGFACE_API_KEY not set, using fallback naming');
    return null;
  }

  try {
    const response = await fetch(`${HF_API_URL}/${COLOR_NAMING_MODEL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 100,
          temperature: 0.3,
          top_p: 0.9,
          top_k: 10,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 503) {
        console.log('   → Model loading, waiting 10 seconds...');
        await new Promise((r) => setTimeout(r, 10000));
        return callGemma(prompt);
      }
      console.log(`   ✗ Gemma API failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as GemmaResponse[];
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return data[0].generated_text || null;
  } catch (error) {
    console.log(`   ✗ Gemma API error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

/**
 * Fallback color naming (basic hue-based)
 */
function getBasicColorName(rgb: RGBValues): string {
  const { r, g, b } = rgb;
  const brightness = (r + g + b) / 3;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;

  // Grayscale detection
  if (saturation < 0.1) {
    if (brightness > 200) return 'White';
    if (brightness < 50) return 'Black';
    return 'Gray';
  }

  // Determine hue
  let hue = '';
  const redDom = r > g && r > b;
  const greenDom = g > r && g > b;
  const blueDom = b > r && b > g;

  if (redDom) {
    hue = g > b ? 'Orange' : 'Red';
  } else if (greenDom) {
    hue = r > b ? 'Lime' : 'Green';
  } else if (blueDom) {
    hue = g > r ? 'Cyan' : 'Blue';
  } else if (r > b && g > b) {
    hue = 'Yellow';
  } else if (r > g && b > g) {
    hue = 'Magenta';
  } else {
    hue = 'Color';
  }

  // Add brightness modifier
  if (brightness < 80) return `Dark ${hue}`;
  if (brightness > 180) return `Light ${hue}`;
  return hue;
}

/**
 * Generate color name using Gemma 2 2B IT
 */
export async function generateColorName(rgb: RGBValues): Promise<string> {
  const basicName = getBasicColorName(rgb);
  const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

  const prompt = `You are a professional color naming system.

Given this RGB color: R=${rgb.r}, G=${rgb.g}, B=${rgb.b} (hex: ${hex})
The basic color category is: ${basicName}

Generate ONE specific, professional color name (2-3 words max).
Examples: "Ocean Blue", "Coral Red", "Sage Green", "Deep Plum", "Sand Beige"

Respond with ONLY the color name, nothing else:`;

  console.log(`   → Naming color ${hex} (${basicName})...`);

  const response = await callGemma(prompt);

  if (!response) {
    console.log(`   ✓ Using fallback name: ${basicName}`);
    return basicName;
  }

  // Extract first line and clean up
  const colorName = response
    .split('\n')[0]
    .trim()
    .replace(/^[*_\-]/g, '')
    .replace(/[*_\-]$/g, '')
    .trim();

  // Validate result (should be 1-5 words)
  const words = colorName.split(/\s+/).length;
  if (
    words > 5 ||
    colorName.length > 50 ||
    colorName.toLowerCase().includes('here') ||
    !colorName
  ) {
    console.log(`   ✓ Using fallback name: ${basicName}`);
    return basicName;
  }

  console.log(`   ✓ Generated name: ${colorName}`);
  return colorName;
}
