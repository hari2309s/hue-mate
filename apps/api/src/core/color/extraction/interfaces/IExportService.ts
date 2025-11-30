import type { ExtractedColor, ExportFormats } from '@hue-und-you/types';

export interface IExportService {
  generate(palette: ExtractedColor[]): ExportFormats;
}
