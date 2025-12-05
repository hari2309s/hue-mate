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

class ServiceContainer {
  private static instance: ServiceContainer;

  private _segmentation?: ISegmentationService;
  private _pixelExtraction?: IPixelExtractionService;
  private _clustering?: IClusteringService;
  private _colorFormatting?: IColorFormattingService;
  private _export?: IExportService;
  private _metadata?: IMetadataService;
  private _orchestrator?: ColorExtractionOrchestrator;

  private constructor() {}

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  get segmentation(): ISegmentationService {
    if (!this._segmentation) {
      this._segmentation = new SegmentationService();
    }
    return this._segmentation;
  }

  get pixelExtraction(): IPixelExtractionService {
    if (!this._pixelExtraction) {
      this._pixelExtraction = new PixelExtractionService();
    }
    return this._pixelExtraction;
  }

  get clustering(): IClusteringService {
    if (!this._clustering) {
      this._clustering = new ClusteringService();
    }
    return this._clustering;
  }

  get colorFormatting(): IColorFormattingService {
    if (!this._colorFormatting) {
      this._colorFormatting = new ColorFormattingService();
    }
    return this._colorFormatting;
  }

  get export(): IExportService {
    if (!this._export) {
      this._export = new ExportService();
    }
    return this._export;
  }

  get metadata(): IMetadataService {
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

    if (!overrides.orchestrator && Object.keys(overrides).length > 0) {
      this._orchestrator = undefined;
    }
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

export const services = ServiceContainer.getInstance();
export { ServiceContainer };

