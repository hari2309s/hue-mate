import type { ExtractedColor } from '@hue-und-you/types';
import { deduplicateColors } from '@/core/export/utils';

export function generateSwiftCode(palette: ExtractedColor[]): string {
  const deduplicated = deduplicateColors(palette);
  const lines = ['import SwiftUI', '', 'extension Color {'];

  deduplicated.forEach((c) => {
    const name = c.name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const { r, g, b } = c.formats.rgb.values;
    lines.push(
      `    static let ${name} = Color(red: ${(r / 255).toFixed(3)}, green: ${(g / 255).toFixed(3)}, blue: ${(b / 255).toFixed(3)})`
    );
  });

  lines.push('}');
  return lines.join('\n');
}
