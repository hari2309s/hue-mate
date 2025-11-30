import type { RGBValues, ExtractedColor } from '@hue-und-you/types';

export interface ColorFormattingOptions {
  generateHarmonies?: boolean;
}

export interface IColorFormattingService {
  format(
    rgb: RGBValues,
    weight: number,
    segment: 'foreground' | 'background',
    index: number,
    options?: ColorFormattingOptions
  ): Promise<ExtractedColor>;

  resetNameTracker(): void;
}
