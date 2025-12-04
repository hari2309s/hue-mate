import { generateExports } from '../../../export';
import type { IExportService } from '../types';
import type { ExtractedColor, ExportFormats } from '@hue-und-you/types';

export class ExportService implements IExportService {
  generate(palette: ExtractedColor[]): ExportFormats {
    return generateExports(palette);
  }
}
