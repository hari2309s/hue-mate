interface ImageData {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

class ImageStorageService {
  private imageStore = new Map<string, ImageData>();

  set(id: string, data: ImageData): void {
    this.imageStore.set(id, data);
  }

  get(id: string): ImageData | undefined {
    return this.imageStore.get(id);
  }

  delete(id: string): boolean {
    return this.imageStore.delete(id);
  }

  has(id: string): boolean {
    return this.imageStore.has(id);
  }

  clear(): void {
    this.imageStore.clear();
  }

  size(): number {
    return this.imageStore.size;
  }
}

export const imageStorage = new ImageStorageService();
