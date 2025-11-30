import type { PixelData, PixelWithWeight } from '../../../../types/segmentation';

export interface ClusteringResult {
  dominantFgColors: PixelWithWeight[];
  dominantBgColors: PixelWithWeight[];
}

export interface ClusteringOptions {
  numColors?: number;
}

export interface IClusteringService {
  cluster(
    fgPixels: PixelData[],
    bgPixels: PixelData[],
    options?: ClusteringOptions
  ): Promise<ClusteringResult>;
}
