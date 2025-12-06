/**
 * Service Container for Dependency Injection
 */

import {
  SegmentationService,
  PixelExtractionService,
  ClusteringService,
  ColorFormattingService,
  ExportService,
  MetadataService,
  ColorExtractionOrchestrator,
} from '@hue-und-you/color-engine';

class ServiceContainer {
  private static instance: ServiceContainer;

  private _segmentation?: SegmentationService;
  private _pixelExtraction?: PixelExtractionService;
  private _clustering?: ClusteringService;
  private _colorFormatting?: ColorFormattingService;
  private _export?: ExportService;
  private _metadata?: MetadataService;
  private _orchestrator?: ColorExtractionOrchestrator;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  get segmentation(): SegmentationService {
    if (!this._segmentation) {
      this._segmentation = new SegmentationService();
    }
    return this._segmentation;
  }

  get pixelExtraction(): PixelExtractionService {
    if (!this._pixelExtraction) {
      this._pixelExtraction = new PixelExtractionService();
    }
    return this._pixelExtraction;
  }

  get clustering(): ClusteringService {
    if (!this._clustering) {
      this._clustering = new ClusteringService();
    }
    return this._clustering;
  }

  get colorFormatting(): ColorFormattingService {
    if (!this._colorFormatting) {
      this._colorFormatting = new ColorFormattingService();
    }
    return this._colorFormatting;
  }

  get export(): ExportService {
    if (!this._export) {
      this._export = new ExportService();
    }
    return this._export;
  }

  get metadata(): MetadataService {
    if (!this._metadata) {
      this._metadata = new MetadataService();
    }
    return this._metadata;
  }

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

  reset(): void {
    this._segmentation = undefined;
    this._pixelExtraction = undefined;
    this._clustering = undefined;
    this._colorFormatting = undefined;
    this._export = undefined;
    this._metadata = undefined;
    this._orchestrator = undefined;
  }
}

export const services = ServiceContainer.getInstance();
export { ServiceContainer };
