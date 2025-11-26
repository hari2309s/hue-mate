import type { UploadStatus, ColorPaletteResult } from '@hue-und-you/types';

interface JobData {
  status: UploadStatus;
  progress: number;
  message: string;
  result?: ColorPaletteResult;
}

class JobQueueService {
  private jobStore = new Map<string, JobData>();

  set(id: string, data: JobData): void {
    this.jobStore.set(id, data);
  }

  get(id: string): JobData | undefined {
    return this.jobStore.get(id);
  }

  update(id: string, partial: Partial<JobData>): void {
    const existing = this.jobStore.get(id);
    if (existing) {
      this.jobStore.set(id, { ...existing, ...partial });
    }
  }

  delete(id: string): boolean {
    return this.jobStore.delete(id);
  }

  has(id: string): boolean {
    return this.jobStore.has(id);
  }

  clear(): void {
    this.jobStore.clear();
  }

  size(): number {
    return this.jobStore.size;
  }
}

export const jobQueue = new JobQueueService();
