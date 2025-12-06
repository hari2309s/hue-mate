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

export interface OklabColor {
  l: number;
  a: number;
  b: number;
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

export interface TintShade {
  level: number;
  hex: string;
  oklch: string;
  name: string;
}

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

export interface ColorMetadata {
  temperature: 'warm' | 'cool' | 'neutral';
  nearest_css_color: string;
  pantone_approximation?: string;
  css_variable_name: string;
}

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
