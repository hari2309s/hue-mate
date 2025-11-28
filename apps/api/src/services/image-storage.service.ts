import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { logger } from '../utils';
import { APP_CONFIG } from '../config';

export interface ImageData {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

interface ImageMetadata {
  filename: string;
  contentType: string;
  createdAt: Date;
}

class ImageStorageService {
  private imageStore = new Map<string, string>(); // Map<id, filePath>
  private metadataStore = new Map<string, ImageMetadata>();
  private tempDir: string;
  private initialized: boolean = false;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'hue-und-you-uploads');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.success('Image storage initialized', { tempDir: this.tempDir });
      this.initialized = true;
    } catch (err) {
      logger.error('Failed to create temp directory', { error: err });
      throw err;
    }
  }

  async set(id: string, data: ImageData): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const filePath = path.join(this.tempDir, `${id}.img`);

    try {
      await fs.writeFile(filePath, data.buffer);
      this.imageStore.set(id, filePath);
      this.metadataStore.set(id, {
        filename: data.filename,
        contentType: data.contentType,
        createdAt: new Date(),
      });

      logger.info('Image stored', {
        imageId: id,
        filename: data.filename,
        size: data.buffer.length,
      });
    } catch (err) {
      logger.error('Failed to store image', { imageId: id, error: err });
      throw err;
    }
  }

  async get(id: string): Promise<ImageData | undefined> {
    const filePath = this.imageStore.get(id);
    const metadata = this.metadataStore.get(id);

    if (!filePath || !metadata) {
      return undefined;
    }

    try {
      const buffer = await fs.readFile(filePath);
      return {
        buffer,
        filename: metadata.filename,
        contentType: metadata.contentType,
      };
    } catch (err) {
      logger.warn('Failed to read image file', { imageId: id, error: err });
      // Clean up stale references
      this.imageStore.delete(id);
      this.metadataStore.delete(id);
      return undefined;
    }
  }

  async delete(id: string): Promise<boolean> {
    const filePath = this.imageStore.get(id);

    if (!filePath) {
      return false;
    }

    try {
      await fs.unlink(filePath);
      this.imageStore.delete(id);
      this.metadataStore.delete(id);
      logger.info('Image deleted', { imageId: id });
      return true;
    } catch (err) {
      logger.warn('Failed to delete image file', { imageId: id, error: err });
      // Clean up references even if file deletion fails
      this.imageStore.delete(id);
      this.metadataStore.delete(id);
      return false;
    }
  }

  has(id: string): boolean {
    return this.imageStore.has(id);
  }

  async clear(): Promise<void> {
    const ids = Array.from(this.imageStore.keys());
    await Promise.all(ids.map((id) => this.delete(id)));
    logger.info('All images cleared');
  }

  size(): number {
    return this.imageStore.size;
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) return;

    const now = Date.now();
    let cleaned = 0;

    for (const [id, filePath] of this.imageStore.entries()) {
      try {
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > APP_CONFIG.TEMP_FILE_CLEANUP_MS) {
          await this.delete(id);
          cleaned++;
        }
      } catch (err) {
        // File doesn't exist, clean up reference
        this.imageStore.delete(id);
        this.metadataStore.delete(id);
      }
    }

    if (cleaned > 0) {
      logger.info('Cleanup completed', { filesRemoved: cleaned });
    }
  }

  getMetadata(id: string): ImageMetadata | undefined {
    return this.metadataStore.get(id);
  }

  getAllIds(): string[] {
    return Array.from(this.imageStore.keys());
  }
}

export const imageStorage = new ImageStorageService();

// Schedule periodic cleanup
setInterval(() => {
  imageStorage.cleanup().catch((err) => {
    logger.error('Cleanup task failed', { error: err });
  });
}, APP_CONFIG.CLEANUP_INTERVAL_MS);
