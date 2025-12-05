import { generateExports } from '@/core/export';
import type { IExportService } from '@/core/color/extraction/types';
import type { ExtractedColor, ExportFormats } from '@hue-und-you/types';

export class ExportService implements IExportService {
  generate(palette: ExtractedColor[]): ExportFormats {
    return generateExports(palette);
  }
}
