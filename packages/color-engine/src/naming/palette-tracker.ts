import type { PaletteToneMap, ToneBucket } from '@hute-mate/types';

export class PaletteNameTracker {
  private usedBaseNames = new Set<string>();
  private usedFullNames = new Set<string>();
  private descriptorCount: Record<string, number> = {};
  private hueFamilyCount: Record<string, number> = {};

  pickName(map: PaletteToneMap, tone: ToneBucket, seed: number, hueFamily: string): string {
    const options = map[tone] ?? map.medium;
    if (!options.length) return map.medium[0] ?? 'Color';

    const familyCount = this.hueFamilyCount[hueFamily] || 0;
    this.hueFamilyCount[hueFamily] = familyCount + 1;

    const startOffset = familyCount > 1 ? familyCount : 0;

    for (let offset = startOffset; offset < options.length + startOffset; offset++) {
      const index = (Math.abs(seed) + offset) % options.length;
      const candidate = options[index];
      const candidateLower = candidate.toLowerCase();

      let isTooSimilar = false;
      for (const used of this.usedBaseNames) {
        if (
          used === candidateLower ||
          used.includes(candidateLower) ||
          candidateLower.includes(used)
        ) {
          isTooSimilar = true;
          break;
        }

        const words1 = used.split(/\s+/);
        const words2 = candidateLower.split(/\s+/);
        const commonWords = words1.filter((w) => words2.includes(w));
        if (commonWords.length > 0 && words1.length <= 2) {
          isTooSimilar = true;
          break;
        }
      }

      if (!isTooSimilar) {
        this.usedBaseNames.add(candidateLower);
        return candidate;
      }
    }

    const base = options[Math.abs(seed) % options.length];
    const count = (this.descriptorCount[base] || 0) + 1;
    this.descriptorCount[base] = count;

    const suffixes = ['Dark', 'Light', 'Deep', 'Soft', 'Muted', 'Bright', 'Rich'];
    for (const suffix of suffixes) {
      const variant = `${suffix} ${base}`;
      if (!this.usedFullNames.has(variant.toLowerCase())) {
        this.usedFullNames.add(variant.toLowerCase());
        return variant;
      }
    }

    return `${base} ${count + 1}`;
  }

  pickDescriptor(descriptor: string | null, baseName: string): string | null {
    if (!descriptor) return null;

    const lowerBase = baseName.toLowerCase();
    const lowerDesc = descriptor.toLowerCase();

    if (lowerBase.includes(lowerDesc)) return null;

    const count = this.descriptorCount[descriptor] || 0;

    if (count >= 1) return null;

    this.descriptorCount[descriptor] = count + 1;
    return descriptor;
  }

  markUsed(name: string): void {
    this.usedFullNames.add(name.toLowerCase());
  }

  reset(): void {
    this.usedBaseNames.clear();
    this.usedFullNames.clear();
    this.descriptorCount = {};
    this.hueFamilyCount = {};
  }
}

let paletteTracker = new PaletteNameTracker();

export function resetPaletteNameTracker(): void {
  paletteTracker = new PaletteNameTracker();
}

export function getPaletteTracker(): PaletteNameTracker {
  return paletteTracker;
}
