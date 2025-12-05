/**
 * Service Container for Dependency Injection
 *
 * Centralized registry for all application services.
 * Provides lazy initialization, singleton management, and easy mocking for tests.
 *
 * Usage:
 *   import { services } from '@/services/container';
 *   const result = await services.orchestrator.extract(buffer, filename);
 *
 * Testing:
 *   services.override({ segmentation: mockSegmentationService });
 *   // ... run tests ...
 *   services.reset();
 */

import {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
} from '@/core/color/extraction/services';

import { ColorExtractionOrchestrator } from '@/core/color/extraction/ColorExtractionOrchestrator';

import type {
  ISegmentationService,
  IPixelExtractionService,
  IClusteringService,
  IColorFormattingService,
  IExportService,
  IMetadataService,
} from '@/core/color/extraction/types';

// ============================================================================
// SERVICE CONTAINER
// ============================================================================

/**
 * Service container for dependency injection.
 * Implements singleton pattern with lazy initialization.
 */
class ServiceContainer {
  private static instance: ServiceContainer;

  // Service instances (private, accessed via getters)
  private _segmentation?: ISegmentationService;
  private _pixelExtraction?: IPixelExtractionService;
  private _clustering?: IClusteringService;
  private _colorFormatting?: IColorFormattingService;
  private _export?: IExportService;
  private _metadata?: IMetadataService;
  private _orchestrator?: ColorExtractionOrchestrator;

  private constructor() {
    // Private constructor enforces singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  // ============================================================================
  // SERVICE GETTERS (lazy initialization)
  // ============================================================================

  /**
   * Segmentation service - handles foreground/background separation
   */
  get segmentation(): ISegmentationService {
    if (!this._segmentation) {
      this._segmentation = new SegmentationService();
    }
    return this._segmentation;
  }

  /**
   * Pixel extraction service - samples pixels from image
   */
  get pixelExtraction(): IPixelExtractionService {
    if (!this._pixelExtraction) {
      this._pixelExtraction = new PixelExtractionService();
    }
    return this._pixelExtraction;
  }

  /**
   * Clustering service - groups similar colors using k-means
   */
  get clustering(): IClusteringService {
    if (!this._clustering) {
      this._clustering = new ClusteringService();
    }
    return this._clustering;
  }

  /**
   * Color formatting service - generates color names, formats, accessibility info
   */
  get colorFormatting(): IColorFormattingService {
    if (!this._colorFormatting) {
      this._colorFormatting = new ColorFormattingService();
    }
    return this._colorFormatting;
  }

  /**
   * Export service - generates CSS, Tailwind, Figma tokens, etc.
   */
  get export(): IExportService {
    if (!this._export) {
      this._export = new ExportService();
    }
    return this._export;
  }

  /**
   * Metadata service - builds extraction metadata
   */
  get metadata(): IMetadataService {
    if (!this._metadata) {
      this._metadata = new MetadataService();
    }
    return this._metadata;
  }

  /**
   * Orchestrator - main color extraction pipeline
   */
  get orchestrator(): ColorExtractionOrchestrator {
    if (!this._orchestrator) {
      this._orchestrator = new ColorExtractionOrchestrator(
        this.segmentation,
        this.pixelExtraction,
        this.clustering,
        this.colorFormatting,
        this.export,
        this.metadata
      );
    }
    return this._orchestrator;
  }

  // ============================================================================
  // TESTING UTILITIES
  // ============================================================================

  /**
   * Override services for testing
   *
   * @example
   * ```ts
   * const mockSegmentation = {
   *   segment: vi.fn().mockResolvedValue({ ... })
   * };
   *
   * services.override({ segmentation: mockSegmentation });
   * // ... run tests ...
   * services.reset();
   * ```
   */
  override(
    overrides: Partial<{
      segmentation: ISegmentationService;
      pixelExtraction: IPixelExtractionService;
      clustering: IClusteringService;
      colorFormatting: IColorFormattingService;
      export: IExportService;
      metadata: IMetadataService;
      orchestrator: ColorExtractionOrchestrator;
    }>
  ): void {
    if (overrides.segmentation) this._segmentation = overrides.segmentation;
    if (overrides.pixelExtraction) this._pixelExtraction = overrides.pixelExtraction;
    if (overrides.clustering) this._clustering = overrides.clustering;
    if (overrides.colorFormatting) this._colorFormatting = overrides.colorFormatting;
    if (overrides.export) this._export = overrides.export;
    if (overrides.metadata) this._metadata = overrides.metadata;
    if (overrides.orchestrator) this._orchestrator = overrides.orchestrator;

    // Reset orchestrator when dependencies change
    if (!overrides.orchestrator && Object.keys(overrides).length > 0) {
      this._orchestrator = undefined;
    }
  }

  /**
   * Reset all services (useful for testing cleanup)
   *
   * @example
   * ```ts
   * afterEach(() => {
   *   services.reset();
   * });
   * ```
   */
  reset(): void {
    this._segmentation = undefined;
    this._pixelExtraction = undefined;
    this._clustering = undefined;
    this._colorFormatting = undefined;
    this._export = undefined;
    this._metadata = undefined;
    this._orchestrator = undefined;
  }

  /**
   * Check if any services are initialized
   */
  get isInitialized(): boolean {
    return !!(
      this._segmentation ||
      this._pixelExtraction ||
      this._clustering ||
      this._colorFormatting ||
      this._export ||
      this._metadata ||
      this._orchestrator
    );
  }

  /**
   * Get list of initialized services (useful for debugging)
   */
  getInitializedServices(): string[] {
    const initialized: string[] = [];
    if (this._segmentation) initialized.push('segmentation');
    if (this._pixelExtraction) initialized.push('pixelExtraction');
    if (this._clustering) initialized.push('clustering');
    if (this._colorFormatting) initialized.push('colorFormatting');
    if (this._export) initialized.push('export');
    if (this._metadata) initialized.push('metadata');
    if (this._orchestrator) initialized.push('orchestrator');
    return initialized;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Singleton service container instance
 *
 * @example
 * ```ts
 * import { services } from '@/services/container';
 *
 * // Use orchestrator directly
 * const result = await services.orchestrator.extract(buffer, filename);
 *
 * // Or use individual services
 * const segmentation = await services.segmentation.segment(buffer);
 * ```
 */
export const services = ServiceContainer.getInstance();

/**
 * Service container class (for testing)
 */
export { ServiceContainer };
