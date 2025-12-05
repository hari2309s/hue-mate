export type ToneBucket = 'dark' | 'medium' | 'light';

export interface PaletteToneMap {
  dark: string[];
  medium: string[];
  light: string[];
}

export interface HuePalette {
  family: string;
  range: [number, number];
  names: PaletteToneMap;
}

export const NEUTRAL_THRESHOLD = 12;
export const EARTH_SAT_THRESHOLD = 45;

export const NEUTRAL_NAMES: PaletteToneMap = {
  dark: ['Obsidian Ash', 'Charcoal Drift', 'Inkstone Gray', 'Shadow Slate', 'Steel Night'],
  medium: ['Fogbound Slate', 'Dove Feather', 'Silver Haze', 'Stone Mist', 'Ash Cloud'],
  light: ['Pearl Mist', 'Cloud Linen', 'Frosted Ivory', 'Moonlit Silk', 'Vapor White'],
};

export const EARTH_TONES: PaletteToneMap = {
  dark: ['Roasted Umber', 'Espresso Soil', 'Chestnut Bark', 'Mahogany Shadow', 'Coffee Bean'],
  medium: ['Copper Canyon', 'Amber Clay', 'Russet Trail', 'Terra Sienna', 'Canyon Stone'],
  light: ['Sandstone Glow', 'Golden Wheat', 'Honey Dust', 'Desert Sand', 'Warm Linen'],
};

export const HUE_PALETTES: HuePalette[] = [
  {
    family: 'Crimson',
    range: [345, 20],
    names: {
      dark: ['Garnet', 'Merlot', 'Burgundy', 'Wine Red', 'Ruby'],
      medium: ['Scarlet', 'Cherry', 'Vermilion', 'Cardinal', 'Poppy'],
      light: ['Rose', 'Coral', 'Blush', 'Pink', 'Salmon'],
    },
  },
  {
    family: 'Copper',
    range: [20, 45],
    names: {
      dark: ['Copper', 'Burnt Sienna', 'Rust', 'Bronze', 'Clay'],
      medium: ['Tangerine', 'Persimmon', 'Pumpkin', 'Terracotta', 'Autumn'],
      light: ['Apricot', 'Peach', 'Coral', 'Melon', 'Cantaloupe'],
    },
  },
  {
    family: 'Solar',
    range: [45, 75],
    names: {
      dark: ['Amber', 'Goldenrod', 'Ochre', 'Bronze', 'Honey'],
      medium: ['Sunflower', 'Citrine', 'Marigold', 'Saffron', 'Gold'],
      light: ['Lemon', 'Butter', 'Champagne', 'Cream', 'Vanilla'],
    },
  },
  {
    family: 'Lime',
    range: [75, 110],
    names: {
      dark: ['Olive', 'Moss', 'Forest', 'Jade', 'Hunter'],
      medium: ['Lime', 'Chartreuse', 'Grass', 'Sage', 'Kiwi'],
      light: ['Celery', 'Mint', 'Pistachio', 'Spring', 'Tea'],
    },
  },
  {
    family: 'Verdant',
    range: [110, 150],
    names: {
      dark: ['Pine', 'Spruce', 'Evergreen', 'Jungle', 'Emerald'],
      medium: ['Meadow', 'Fern', 'Clover', 'Kelly', 'Grass'],
      light: ['Mint', 'Seafoam', 'Celadon', 'Sage', 'Laurel'],
    },
  },
  {
    family: 'Emerald',
    range: [150, 185],
    names: {
      dark: ['Teal', 'Jade', 'Viridian', 'Malachite', 'Cypress'],
      medium: ['Emerald', 'Turquoise', 'Caribbean', 'Tropical', 'Aquamarine'],
      light: ['Seafoam', 'Aqua', 'Mint', 'Sea Glass', 'Foam'],
    },
  },
  {
    family: 'Lagoon',
    range: [185, 210],
    names: {
      dark: ['Teal', 'Cyan', 'Ocean', 'Peacock', 'Marine'],
      medium: ['Lagoon', 'Aqua', 'Turquoise', 'Caribbean', 'Teal'],
      light: ['Sky Blue', 'Pool', 'Aqua', 'Ice', 'Mist'],
    },
  },
  {
    family: 'Azure',
    range: [210, 240],
    names: {
      dark: ['Navy', 'Cobalt', 'Sapphire', 'Midnight', 'Indigo'],
      medium: ['Azure', 'Cerulean', 'Sky', 'Ocean', 'Pacific'],
      light: ['Powder Blue', 'Baby Blue', 'Periwinkle', 'Alice Blue', 'Ice'],
    },
  },
  {
    family: 'Indigo',
    range: [240, 275],
    names: {
      dark: ['Indigo', 'Sapphire', 'Midnight', 'Royal', 'Navy'],
      medium: ['Iris', 'Periwinkle', 'Cornflower', 'Blue Violet', 'Hyacinth'],
      light: ['Lavender', 'Lilac', 'Wisteria', 'Mauve', 'Thistle'],
    },
  },
  {
    family: 'Violet',
    range: [275, 305],
    names: {
      dark: ['Amethyst', 'Purple', 'Plum', 'Eggplant', 'Grape'],
      medium: ['Violet', 'Orchid', 'Purple', 'Iris', 'Heather'],
      light: ['Lilac', 'Lavender', 'Orchid', 'Mauve', 'Periwinkle'],
    },
  },
  {
    family: 'Magenta',
    range: [305, 345],
    names: {
      dark: ['Plum', 'Mulberry', 'Wine', 'Eggplant', 'Maroon'],
      medium: ['Fuchsia', 'Magenta', 'Hot Pink', 'Cerise', 'Orchid'],
      light: ['Pink', 'Rose', 'Peony', 'Carnation', 'Blush'],
    },
  },
];

export function normalizeHue(h: number): number {
  let hue = h % 360;
  if (hue < 0) hue += 360;
  return hue;
}

export function inHueRange(h: number, [start, end]: [number, number]): boolean {
  if (start <= end) {
    return h >= start && h < end;
  }
  return h >= start || h < end;
}

export function getHuePalette(h: number): HuePalette {
  const hue = normalizeHue(h);
  return HUE_PALETTES.find((palette) => inHueRange(hue, palette.range)) ?? HUE_PALETTES[0];
}

export function getToneBucket(lightness: number, saturation: number): ToneBucket {
  const darknessThreshold = saturation > 60 ? 40 : 35;
  const lightnessThreshold = saturation > 60 ? 65 : 70;

  if (lightness <= darknessThreshold) return 'dark';
  if (lightness >= lightnessThreshold) return 'light';
  return 'medium';
}
