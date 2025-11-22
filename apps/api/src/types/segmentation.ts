export interface SegmentResult {
  label: string;
  mask: string; // base64-encoded black-and-white image
  score: number;
}

export interface ForegroundMask {
  mask: Buffer;
  foreground_percentage: number;
}

export interface PixelData {
  r: number;
  g: number;
  b: number;
}

export interface PixelWithWeight extends PixelData {
  weight: number;
}

export interface OklabColor {
  l: number;
  a: number;
  b: number;
}

export interface PixelWithOklab extends PixelData {
  oklab: OklabColor;
}

export interface ExtractedPixels {
  pixels: PixelData[];
  isForeground: boolean[];
}
