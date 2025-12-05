import type { ExtractedColor } from '@hue-und-you/types';
import { deduplicateColors } from '@/core/export/utils';

export function generateKotlinCode(palette: ExtractedColor[]): string {
  const deduplicated = deduplicateColors(palette);
  const lines = ['import androidx.compose.ui.graphics.Color', '', 'object AppColors {'];

  deduplicated.forEach((c) => {
    const name = c.name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    lines.push(`    val ${name} = Color(0xFF${c.formats.hex.slice(1)})`);
  });

  lines.push('}');
  return lines.join('\n');
}
