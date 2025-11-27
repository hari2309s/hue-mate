import type { SegmentResult } from '../../types/segmentation';

/**
 * Semantic segmentation classification system
 * Uses heuristic-based rules instead of hardcoded label lists
 * to handle any type of image robustly
 */

interface ClassificationRule {
  name: string;
  test: (label: string, score: number, context: SegmentContext) => boolean;
  classification: 'foreground' | 'background' | 'uncertain';
  priority: number; // Higher priority rules are checked first
}

interface SegmentContext {
  allSegments: SegmentResult[];
  totalSegments: number;
  averageScore: number;
  maxScore: number;
  currentSegmentIndex: number;
}

/**
 * Rule-based classification system
 * Add new rules without modifying existing code
 */
class SegmentationClassifier {
  private rules: ClassificationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Priority 1: Definite backgrounds (highest priority)
    this.addRule({
      name: 'sky-background',
      test: (label) => /\b(sky|clouds?|atmosphere)\b/i.test(label),
      classification: 'background',
      priority: 100,
    });

    this.addRule({
      name: 'ground-background',
      test: (label) => /\b(road|pavement|ground|floor|ceiling|sidewalk|path|trail)\b/i.test(label),
      classification: 'background',
      priority: 100,
    });

    // Priority 2: Living entities (very likely foreground)
    this.addRule({
      name: 'living-entities',
      test: (label) =>
        /\b(person|people|human|man|woman|child|baby|face|head)\b/i.test(label) ||
        /\b(animal|bird|cat|dog|horse|elephant|bear|fish|insect)\b/i.test(label) ||
        /\b(wildlife|creature|mammal|reptile)\b/i.test(label),
      classification: 'foreground',
      priority: 90,
    });

    // Priority 3: Vehicles (very likely foreground)
    this.addRule({
      name: 'vehicles',
      test: (label) =>
        /\b(car|truck|bus|van|vehicle|automobile)\b/i.test(label) ||
        /\b(motorcycle|bike|bicycle|scooter)\b/i.test(label) ||
        /\b(boat|ship|yacht|aircraft|airplane|helicopter)\b/i.test(label) ||
        /\b(train|subway|locomotive)\b/i.test(label),
      classification: 'foreground',
      priority: 90,
    });

    // Priority 4: Portable objects (likely foreground)
    this.addRule({
      name: 'portable-objects',
      test: (label) =>
        /\b(bag|backpack|luggage|suitcase|purse|handbag)\b/i.test(label) ||
        /\b(phone|laptop|computer|tablet|device|electronics)\b/i.test(label) ||
        /\b(bottle|cup|glass|mug|container)\b/i.test(label) ||
        /\b(book|magazine|newspaper|paper)\b/i.test(label) ||
        /\b(toy|doll|ball|game)\b/i.test(label) ||
        /\b(tool|instrument|equipment|gear)\b/i.test(label) ||
        /\b(food|fruit|vegetable|meal|dish|snack)\b/i.test(label),
      classification: 'foreground',
      priority: 80,
    });

    // Priority 5: Furniture and fixtures (context-dependent)
    this.addRule({
      name: 'furniture-high-score',
      test: (label, score, context) =>
        (/\b(chair|table|desk|couch|sofa|bed|furniture)\b/i.test(label) ||
          /\b(lamp|light|fixture)\b/i.test(label)) &&
        score > context.averageScore * 1.2 &&
        context.totalSegments >= 3,
      classification: 'foreground',
      priority: 70,
    });

    // Priority 6: Signs and information (likely foreground)
    this.addRule({
      name: 'signs-info',
      test: (label) =>
        /\b(sign|signboard|banner|billboard|poster|placard)\b/i.test(label) ||
        /\b(text|writing|label|tag)\b/i.test(label) ||
        /\b(traffic\s*light|signal|indicator)\b/i.test(label),
      classification: 'foreground',
      priority: 75,
    });

    // Priority 7: Architectural elements with high confidence
    this.addRule({
      name: 'architecture-high-confidence',
      test: (label, score, context) =>
        (/\b(building|house|structure|architecture)\b/i.test(label) ||
          /\b(door|window|balcony|roof)\b/i.test(label) ||
          /\b(column|pillar|arch|dome|tower)\b/i.test(label)) &&
        score > 0.9 &&
        context.totalSegments >= 4,
      classification: 'uncertain',
      priority: 60,
    });

    // Priority 8: Natural foreground elements
    this.addRule({
      name: 'natural-foreground',
      test: (label, score, context) =>
        (/\b(tree|plant|flower|bush|shrub)\b/i.test(label) ||
          /\b(rock|stone|boulder)\b/i.test(label) ||
          /\b(fountain|statue|sculpture|monument)\b/i.test(label)) &&
        (score > context.averageScore * 1.3 || context.totalSegments <= 3),
      classification: 'foreground',
      priority: 65,
    });

    // Priority 9: Walls and large structures (usually background)
    this.addRule({
      name: 'walls-structures',
      test: (label, score, _context) =>
        /\b(wall|brick|concrete|plaster)\b/i.test(label) ||
        (/\b(fence|barrier|railing|gate)\b/i.test(label) && score < 0.85),
      classification: 'background',
      priority: 55,
    });

    // Priority 10: Water and terrain (usually background unless high score)
    this.addRule({
      name: 'water-terrain',
      test: (label, score, context) =>
        (/\b(water|ocean|sea|lake|river|pond|pool)\b/i.test(label) ||
          /\b(sand|beach|desert|dirt|soil|mud)\b/i.test(label) ||
          /\b(grass|lawn|field|meadow|prairie)\b/i.test(label) ||
          /\b(snow|ice|glacier)\b/i.test(label)) &&
        score < context.averageScore * 1.5,
      classification: 'background',
      priority: 50,
    });

    // Priority 11: Small high-confidence segments (likely foreground)
    this.addRule({
      name: 'small-high-confidence',
      test: (_label, score, context) =>
        score > 0.95 && context.totalSegments >= 5 && context.currentSegmentIndex < 3,
      classification: 'uncertain',
      priority: 40,
    });

    // Priority 12: Generic catch-all for unrecognized labels with very high score
    this.addRule({
      name: 'very-high-score',
      test: (_label, score, context) => score > 0.97 && context.totalSegments >= 4,
      classification: 'uncertain',
      priority: 30,
    });

    // Priority 13: Default fallback
    this.addRule({
      name: 'default-background',
      test: () => true,
      classification: 'background',
      priority: 0,
    });
  }

  /**
   * Add custom classification rule
   * Allows extending the system without modifying core code
   */
  addRule(rule: ClassificationRule): void {
    this.rules.push(rule);
    // Keep rules sorted by priority (descending)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a rule by name
   */
  removeRule(name: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter((rule) => rule.name !== name);
    return this.rules.length < initialLength;
  }

  /**
   * Classify a segment using the rule system
   */
  classify(
    label: string,
    score: number,
    allSegments: SegmentResult[]
  ): 'foreground' | 'background' | 'uncertain' {
    const context = this.buildContext(label, score, allSegments);

    // Apply rules in priority order
    for (const rule of this.rules) {
      if (rule.test(label, score, context)) {
        return rule.classification;
      }
    }

    // Should never reach here due to default rule, but just in case
    return 'background';
  }

  /**
   * Build classification context from all segments
   */
  private buildContext(
    currentLabel: string,
    currentScore: number,
    allSegments: SegmentResult[]
  ): SegmentContext {
    const sortedSegments = [...allSegments].sort((a, b) => b.score - a.score);
    const currentIndex = sortedSegments.findIndex(
      (s) =>
        s.label.toLowerCase() === currentLabel.toLowerCase() &&
        Math.abs(s.score - currentScore) < 0.001
    );

    const totalScore = allSegments.reduce((sum, s) => sum + s.score, 0);
    const averageScore = allSegments.length > 0 ? totalScore / allSegments.length : 0;
    const maxScore = allSegments.length > 0 ? Math.max(...allSegments.map((s) => s.score)) : 0;

    return {
      allSegments,
      totalSegments: allSegments.length,
      averageScore,
      maxScore,
      currentSegmentIndex: currentIndex >= 0 ? currentIndex : allSegments.length,
    };
  }

  /**
   * Get all active rules (for debugging/monitoring)
   */
  getRules(): ClassificationRule[] {
    return [...this.rules];
  }
}

// Singleton instance
const classifier = new SegmentationClassifier();

/**
 * Main classification function (backwards compatible with existing code)
 */
export function classifySegment(
  label: string,
  score: number,
  allSegments: SegmentResult[]
): 'foreground' | 'background' | 'uncertain' {
  return classifier.classify(label, score, allSegments);
}

/**
 * Get the classifier instance for advanced usage
 */
export function getClassifier(): SegmentationClassifier {
  return classifier;
}

/**
 * Add custom classification rule
 * Example usage:
 *
 * addClassificationRule({
 *   name: 'custom-food-items',
 *   test: (label) => /\b(pizza|burger|sandwich)\b/i.test(label),
 *   classification: 'foreground',
 *   priority: 85
 * });
 */
export function addClassificationRule(rule: ClassificationRule): void {
  classifier.addRule(rule);
}

/**
 * Remove classification rule by name
 */
export function removeClassificationRule(name: string): boolean {
  return classifier.removeRule(name);
}

/**
 * Export for backwards compatibility (deprecated)
 */
export const FOREGROUND_LABELS = new Set<string>();
export const AMBIGUOUS_LABELS = new Set<string>();
