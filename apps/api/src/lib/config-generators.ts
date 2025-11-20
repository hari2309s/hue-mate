interface ExtractedColor {
  hex: string;
  rgb: [number, number, number];
  hsl: [number, number, number];
  name?: string;
}

/**
 * Generate Tailwind CSS configuration
 */
export function generateTailwindConfig(colors: ExtractedColor[]): string {
  const colorMap: Record<string, string> = {};

  // Create color scale (50-950)
  colors.forEach((color, idx) => {
    const colorName =
      color.name?.toLowerCase().replace(/\s+/g, "-") || `custom-${idx}`;
    const scale = generateColorScale(color.hex);

    colorMap[colorName] = scale;
  });

  return `module.exports = {
  theme: {
    extend: {
      colors: ${JSON.stringify(colorMap, null, 8)}
    }
  },
  plugins: [],
}`;
}

/**
 * Generate Figma design tokens
 */
export function generateFigmaVariables(colors: ExtractedColor[]): string {
  const tokens = {
    colors: {} as Record<string, Record<string, string>>,
  };

  colors.forEach((color, idx) => {
    const colorName =
      color.name?.toLowerCase().replace(/\s+/g, "-") || `custom-${idx}`;
    tokens.colors[colorName] = {
      "50": adjustBrightness(color.hex, 0.95),
      "100": adjustBrightness(color.hex, 0.9),
      "200": adjustBrightness(color.hex, 0.75),
      "300": adjustBrightness(color.hex, 0.6),
      "400": adjustBrightness(color.hex, 0.3),
      "500": color.hex,
      "600": adjustBrightness(color.hex, -0.1),
      "700": adjustBrightness(color.hex, -0.2),
      "800": adjustBrightness(color.hex, -0.3),
      "900": adjustBrightness(color.hex, -0.4),
      "950": adjustBrightness(color.hex, -0.5),
    };
  });

  return JSON.stringify(tokens, null, 2);
}

/**
 * Generate CSS custom properties
 */
export function generateCSSVariables(colors: ExtractedColor[]): string {
  let css = ":root {\n";

  colors.forEach((color, idx) => {
    const colorName =
      color.name?.toLowerCase().replace(/\s+/g, "-") || `custom-${idx}`;
    css += `  --color-${colorName}: ${color.hex};\n`;
    css += `  --color-${colorName}-rgb: ${color.rgb.join(", ")};\n`;
  });

  css += "}\n";

  return css;
}

/**
 * Generate color shade scale
 */
function generateColorScale(hex: string): Record<string, string> {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  const scale: Record<string, string> = {};
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

  shades.forEach((shade) => {
    const factor = (shade - 500) / 500;
    let newL: number;

    if (factor > 0) {
      // Lighten
      newL = l + (100 - l) * (factor * 0.5);
    } else {
      // Darken
      newL = l + l * (factor * 0.5);
    }

    const newRgb = hslToRgb(h, s, newL);
    scale[shade.toString()] = rgbToHex(...newRgb);
  });

  return scale;
}

/**
 * Utility functions for color conversion
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((x) => Math.round(x).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function adjustBrightness(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);

  const newL = Math.max(0, Math.min(100, l + factor * 100));
  const newRgb = hslToRgb(h, s, newL);

  return rgbToHex(...newRgb);
}
