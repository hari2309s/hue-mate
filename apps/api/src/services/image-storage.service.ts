import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { config } from '@hute-mate/config';
import { StorageError, logger } from '@hute-mate/utils';
import type { ImageData } from '@hute-mate/types';

interface ImageMetadata {
  filename: string;
  contentType: string;
  createdAt: Date;
}

class ImageStorageService {
  private imageStore = new Map<string, string>();
  private metadataStore = new Map<string, ImageMetadata>();
  private tempDir: string;
  private initialized: boolean = false;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'hute-mate-uploads');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.success('Image storage initialized', { tempDir: this.tempDir });
      this.initialized = true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(err, { operation: 'storage_initialization' });
      throw new StorageError('Failed to initialize storage', {
        tempDir: this.tempDir,
        error: err.message,
      });
    }
  }

  async set(id: string, data: ImageData): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!id || typeof id !== 'string') {
      throw new StorageError('Invalid image ID', { id });
    }

    if (!Buffer.isBuffer(data.buffer) || data.buffer.length === 0) {
      throw new StorageError('Invalid image buffer', { id });
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
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(err, { operation: 'image_store', imageId: id });

      this.imageStore.delete(id);
      this.metadataStore.delete(id);

      throw new StorageError('Failed to store image', {
        imageId: id,
        error: err.message,
      });
    }
  }

  async get(id: string): Promise<ImageData | undefined> {
    if (!id || typeof id !== 'string') {
      logger.warn('Invalid image ID requested', { id });
      return undefined;
    }

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
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('Failed to read image file', {
        imageId: id,
        error: err.message,
        code: (error as any).code,
      });

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
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn('Failed to delete image file', {
        imageId: id,
        error: err.message,
        code: (error as any).code,
      });

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
    const results = await Promise.allSettled(ids.map((id) => this.delete(id)));

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      logger.warn('Some images failed to clear', { failed, total: ids.length });
    }

    logger.info('Storage cleared', { cleared: ids.length - failed });
  }

  size(): number {
    return this.imageStore.size;
  }

  async cleanup(): Promise<void> {
    if (!this.initialized) return;

    const now = Date.now();
    let cleaned = 0;
    let failed = 0;

    for (const [id, filePath] of this.imageStore.entries()) {
      try {
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;

        if (age > config.app.tempFileCleanupMs) {
          const deleted = await this.delete(id);
          if (deleted) cleaned++;
          else failed++;
        }
      } catch (error) {
        this.imageStore.delete(id);
        this.metadataStore.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0 || failed > 0) {
      logger.info('Cleanup completed', { filesRemoved: cleaned, failed });
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

setInterval(() => {
  imageStorage.cleanup().catch((err) => {
    logger.error('Cleanup task failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}, config.app.cleanupIntervalMs);
