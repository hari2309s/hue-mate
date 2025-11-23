import type { ExtractedColor, RGBValues } from '@hue-und-you/types';

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llava-phi3';

interface ColorUsageSuggestion {
  primary_use: string;
  secondary_uses: string[];
  avoid_for: string[];
  pairs_well_with: string[];
  examples: string;
}

interface ColorMood {
  emotion: string;
  associations: string[];
  cultural_notes?: string;
}

interface ColorDescription {
  palette_description: string;
  mood: string;
  best_for: string[];
}

/**
 * Generate smart usage suggestions for a single color
 */
export async function generateColorUsageSuggestion(
  imageBase64: string,
  color: ExtractedColor,
  allColors: ExtractedColor[]
): Promise<ColorUsageSuggestion | null> {
  try {
    const { r, g, b } = color.formats.rgb.values;
    const contrastRatio = color.accessibility.contrast_on_white.ratio;

    const prompt = `You are a professional color designer analyzing a color palette.

Color: "${color.name}" (RGB: ${r}, ${g}, ${b})
Context: ${color.source.category}
Contrast on white: ${contrastRatio}:1
WCAG AA Normal Text: ${color.accessibility.contrast_on_white.wcag_aa_normal ? 'Pass' : 'Fail'}

Based on the image and color properties, provide usage guidance:

1. PRIMARY USE: One sentence describing the best primary use (e.g., "Perfect for...")
2. SECONDARY USES: 3 specific secondary uses (e.g., "Buttons", "Icons", "Borders")
3. AVOID FOR: 2 things this color should NOT be used for
4. EXAMPLES: One concrete design example

Format as JSON:
{
  "primary_use": "...",
  "secondary_uses": ["...", "...", "..."],
  "avoid_for": ["...", "..."],
  "examples": "..."
}

JSON only:`;

    const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        images: [imageBase64],
        stream: false,
        options: { temperature: 0.3, num_predict: 200 },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { response: string };
    const jsonText = data.response
      .trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '');
    const parsed = JSON.parse(jsonText);

    // Determine which colors pair well (based on contrast and harmony)
    const pairsWellWith = allColors
      .filter((c) => c.id !== color.id)
      .filter((c) => {
        // Simple heuristic: good contrast or complementary
        const colorLuminance =
          (0.299 * color.formats.rgb.values.r +
            0.587 * color.formats.rgb.values.g +
            0.114 * color.formats.rgb.values.b) /
          255;
        const otherLuminance =
          (0.299 * c.formats.rgb.values.r +
            0.587 * c.formats.rgb.values.g +
            0.114 * c.formats.rgb.values.b) /
          255;
        return Math.abs(colorLuminance - otherLuminance) > 0.3;
      })
      .slice(0, 2)
      .map((c) => c.id);

    return {
      primary_use: parsed.primary_use,
      secondary_uses: parsed.secondary_uses,
      avoid_for: parsed.avoid_for,
      pairs_well_with: pairsWellWith,
      examples: parsed.examples,
    };
  } catch (error) {
    console.log(`   ⚠ Failed to generate usage suggestion: ${error}`);
    return null;
  }
}

/**
 * Generate mood/emotion for a color
 */
export async function generateColorMood(
  imageBase64: string,
  color: ExtractedColor
): Promise<ColorMood | null> {
  try {
    const { r, g, b } = color.formats.rgb.values;

    const prompt = `Analyze the emotional impact of this color in the image context.

Color: "${color.name}" (RGB: ${r}, ${g}, ${b})
Context: ${color.source.category}

Provide:
1. EMOTION: One word describing the primary emotion (e.g., "Calming", "Energetic", "Professional")
2. ASSOCIATIONS: 3 words/concepts people associate with this color
3. CULTURAL NOTE: One sentence about cultural meaning (optional)

Format as JSON:
{
  "emotion": "...",
  "associations": ["...", "...", "..."],
  "cultural_notes": "..."
}

JSON only:`;

    const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        images: [imageBase64],
        stream: false,
        options: { temperature: 0.4, num_predict: 150 },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { response: string };
    const jsonText = data.response
      .trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '');
    const parsed = JSON.parse(jsonText);

    return {
      emotion: parsed.emotion,
      associations: parsed.associations,
      cultural_notes: parsed.cultural_notes || undefined,
    };
  } catch (error) {
    console.log(`   ⚠ Failed to generate color mood: ${error}`);
    return null;
  }
}

/**
 * Generate overall palette description
 */
export async function generatePaletteDescription(
  imageBase64: string,
  palette: ExtractedColor[],
  filename: string
): Promise<ColorDescription | null> {
  try {
    const colorList = palette.map((c) => `"${c.name}"`).join(', ');
    const categories = [...new Set(palette.map((c) => c.source.category))].join(', ');

    const prompt = `You are analyzing a color palette extracted from an image.

Image: ${filename}
Colors: ${colorList}
Scene elements: ${categories}

Provide a professional analysis:

1. DESCRIPTION: 2-3 sentences describing the overall palette and its character
2. MOOD: One sentence describing the emotional tone
3. BEST FOR: 3 specific use cases or industries this palette works well for

Format as JSON:
{
  "palette_description": "...",
  "mood": "...",
  "best_for": ["...", "...", "..."]
}

JSON only:`;

    const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        images: [imageBase64],
        stream: false,
        options: { temperature: 0.5, num_predict: 250 },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { response: string };
    const jsonText = data.response
      .trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '');
    const parsed = JSON.parse(jsonText);

    return {
      palette_description: parsed.palette_description,
      mood: parsed.mood,
      best_for: parsed.best_for,
    };
  } catch (error) {
    console.log(`   ⚠ Failed to generate palette description: ${error}`);
    return null;
  }
}

/**
 * AI-powered temperature classification (replaces hardcoded hue ranges)
 */
export async function classifyColorTemperature(
  imageBase64: string,
  rgb: RGBValues,
  colorName: string
): Promise<'warm' | 'cool' | 'neutral'> {
  try {
    const prompt = `Look at the "${colorName}" color (RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}) in this image.

Is this a warm, cool, or neutral color?

Reply with ONLY one word: warm, cool, or neutral`;

    const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        images: [imageBase64],
        stream: false,
        options: { temperature: 0.1, num_predict: 3 },
      }),
    });

    if (!response.ok) {
      // Fallback to simple hue-based classification
      return fallbackTemperature(rgb);
    }

    const data = (await response.json()) as { response: string };
    const answer = data.response.trim().toLowerCase();

    if (answer.includes('warm')) return 'warm';
    if (answer.includes('cool')) return 'cool';
    return 'neutral';
  } catch {
    return fallbackTemperature(rgb);
  }
}

/**
 * Fallback temperature classification (simple hue-based)
 */
function fallbackTemperature(rgb: RGBValues): 'warm' | 'cool' | 'neutral' {
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  if (max === min) return 'neutral'; // Grayscale

  if (r === max && b === min) return 'warm'; // Red-orange-yellow range
  if (b === max && r === min) return 'cool'; // Blue-cyan range
  return 'neutral';
}
