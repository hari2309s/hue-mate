import { logger } from '@hue-und-you/utils';
import type { JobData, UploadStatus } from '@hue-und-you/types';

class JobQueueService {
  private jobStore = new Map<string, JobData>();
  private processingLocks = new Map<string, Promise<unknown>>();

  set(id: string, data: JobData): void {
    this.jobStore.set(id, {
      ...data,
      startedAt: data.startedAt || new Date(),
    });

    logger.info('Job created', {
      jobId: id,
      status: data.status,
      progress: data.progress,
    });
  }

  get(id: string): JobData | undefined {
    return this.jobStore.get(id);
  }

  update(id: string, partial: Partial<JobData>): void {
    const existing = this.jobStore.get(id);

    if (!existing) {
      logger.warn('Attempted to update non-existent job', { jobId: id });
      return;
    }

    const updated: JobData = {
      ...existing,
      ...partial,
      ...(partial.status === 'complete' && { completedAt: new Date() }),
    };

    this.jobStore.set(id, updated);

    logger.info('Job updated', {
      jobId: id,
      status: updated.status,
      progress: updated.progress,
      message: updated.message,
    });
  }

  delete(id: string): boolean {
    const deleted = this.jobStore.delete(id);
    this.processingLocks.delete(id);

    if (deleted) {
      logger.info('Job deleted', { jobId: id });
    }

    return deleted;
  }

  has(id: string): boolean {
    return this.jobStore.has(id);
  }

  clear(): void {
    this.jobStore.clear();
    this.processingLocks.clear();
    logger.info('All jobs cleared');
  }

  size(): number {
    return this.jobStore.size;
  }

  isProcessing(id: string): boolean {
    return this.processingLocks.has(id);
  }

  async withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const existingLock = this.processingLocks.get(id);
    if (existingLock) {
      logger.info('Waiting for existing processing lock', { jobId: id });
      await existingLock;
    }

    const lockPromise = fn().finally(() => {
      this.processingLocks.delete(id);
      logger.info('Processing lock released', { jobId: id });
    });

    this.processingLocks.set(id, lockPromise);
    logger.info('Processing lock acquired', { jobId: id });

    return lockPromise;
  }

  getAllJobIds(): string[] {
    return Array.from(this.jobStore.keys());
  }

  getJobsByStatus(status: UploadStatus): JobData[] {
    const jobs: JobData[] = [];
    for (const [, job] of this.jobStore.entries()) {
      if (job.status === status) {
        jobs.push(job);
      }
    }
    return jobs;
  }
}

export const jobQueue = new JobQueueService();
