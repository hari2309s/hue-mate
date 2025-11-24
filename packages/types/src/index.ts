export interface RGBValues {
  r: number;
  g: number;
  b: number;
}

export interface OKLCHValues {
  l: number;
  c: number;
  h: number;
}

export interface HSLValues {
  h: number;
  s: number;
  l: number;
}

export interface HSBValues {
  h: number;
  s: number;
  b: number;
}

export interface CMYKValues {
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface LABValues {
  l: number;
  a: number;
  b: number;
}

export interface LCHValues {
  l: number;
  c: number;
  h: number;
}

export interface ColorFormats {
  hex: string;
  rgb: { css: string; values: RGBValues };
  oklch: { css: string; values: OKLCHValues };
  hsl: { css: string; values: HSLValues };
  hsb: { css: string; values: HSBValues };
  cmyk: { css: string; values: CMYKValues };
  lab: { css: string; values: LABValues };
  lch: { css: string; values: LCHValues };
}

// Accessibility
export interface ContrastResult {
  ratio: number;
  wcag_aa_normal: boolean;
  wcag_aa_large: boolean;
  wcag_aaa_normal: boolean;
  wcag_aaa_large: boolean;
}

export interface APCAResult {
  on_white: number;
  on_black: number;
}

export interface AccessibilityInfo {
  contrast_on_white: ContrastResult;
  contrast_on_black: ContrastResult;
  apca: APCAResult;
  suggested_text_color: { hex: string; reason: string };
}

// Tints & Shades
export interface TintShade {
  level: number;
  hex: string;
  oklch: string;
  name: string;
}

// Color Harmony
export interface HarmonyColor {
  hex: string;
  oklch: string;
  name: string;
}

export interface ColorHarmony {
  complementary: HarmonyColor;
  analogous: HarmonyColor[];
  triadic: HarmonyColor[];
  split_complementary: HarmonyColor[];
}

// Color Metadata
export interface ColorMetadata {
  temperature: 'warm' | 'cool' | 'neutral';
  nearest_css_color: string;
  pantone_approximation?: string;
  css_variable_name: string;
}

// Extracted Color
export interface ExtractedColor {
  id: string;
  name: string;
  source: {
    segment: 'foreground' | 'background';
    category?: string;
    pixel_coverage: number;
    confidence: number;
  };
  formats: ColorFormats;
  accessibility: AccessibilityInfo;
  tints: TintShade[];
  shades: TintShade[];
  harmony: ColorHarmony;
  metadata: ColorMetadata;
}

// Segmentation Info
export interface SegmentInfo {
  foreground: { pixel_percentage: number };
  background: { pixel_percentage: number };
  categories: string[];
}

// Export Formats
export interface ExportFormats {
  css_variables: string;
  tailwind_config: object;
  figma_tokens: object;
  swift?: string;
  kotlin?: string;
  scss_variables: string;
}

// Complete Palette Result
export interface ColorPaletteResult {
  id: string;
  source_image: {
    filename: string;
    dimensions: { width: number; height: number };
    processed_at: string;
  };
  segments: SegmentInfo;
  palette: ExtractedColor[];
  exports: ExportFormats;
  metadata: ExtractionMetadata;
}

export interface ExtractionMetadata {
  processingTimeMs: number;
  algorithm: 'kmeans++' | 'weighted-kmeans';
  colorDiversity: number;
  averageSaturation: number;
  dominantTemperature: 'warm' | 'cool' | 'neutral';
  suggestedUsage: string;
}

// Upload Status
export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'segmenting'
  | 'extracting'
  | 'complete'
  | 'error';

export interface UploadProgress {
  status: UploadStatus;
  progress: number;
  message: string;
  error?: string;
}

// Database Models
export interface ColorPalette {
  id: number;
  name: string;
  colors: string[];
  description?: string;
  result?: ColorPaletteResult;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface User {
  id: number;
  email: string;
  name?: string;
}

// API Types
export interface UploadImageInput {
  filename: string;
  contentType: string;
  base64Data: string;
}

export interface UploadImageResponse {
  success: boolean;
  imageId: string;
  message: string;
}

export interface ProcessImageInput {
  imageId: string;
  options?: {
    numColors?: number;
    includeBackground?: boolean;
    generateHarmonies?: boolean;
  };
}
