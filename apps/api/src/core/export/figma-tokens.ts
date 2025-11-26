import type { ExtractedColor } from '@hue-und-you/types';
import { deduplicateColors } from './utils';

export function generateFigmaTokens(palette: ExtractedColor[]): object {
  const deduplicated = deduplicateColors(palette);
  const tokens: Record<string, object> = {};

  deduplicated.forEach((c) => {
    const name = c.name.toLowerCase().replace(/\s+/g, '-');
    tokens[name] = {
      value: c.formats.hex,
      type: 'color',
      description: `${c.name} - ${c.metadata.temperature} tone`,
    };
  });

  return { tokens };
}
