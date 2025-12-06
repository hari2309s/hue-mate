import { logger } from '@/utils';

/**
 * Performance monitoring utilities for color extraction pipeline
 * Helps identify bottlenecks and optimize critical paths
 */

interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private operationStack: string[] = [];

  start(operation: string, metadata?: Record<string, any>): void {
    const key =
      this.operationStack.length > 0
        ? `${this.operationStack[this.operationStack.length - 1]}.${operation}`
        : operation;

    this.operationStack.push(key);

    this.metrics.set(key, {
      operation: key,
      startTime: performance.now(),
      metadata,
    });
  }

  end(operation?: string): number {
    const key = operation || this.operationStack.pop();

    if (!key) {
      logger.warn('Performance monitor: no operation to end');
      return 0;
    }

    const metric = this.metrics.get(key);

    if (!metric) {
      logger.warn(`Performance monitor: operation not found: ${key}`);
      return 0;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;

    if (metric.duration > 100) {
      logger.info(`⏱️  ${key}: ${metric.duration.toFixed(2)}ms`, metric.metadata);
    }

    return metric.duration;
  }

  getMetrics(): PerformanceMetrics[] {
    return Array.from(this.metrics.values())
      .filter((m) => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }

  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {};

    for (const metric of this.metrics.values()) {
      if (metric.duration) {
        summary[metric.operation] = metric.duration;
      }
    }

    return summary;
  }

  reset(): void {
    this.metrics.clear();
    this.operationStack = [];
  }

  printSummary(): void {
    const metrics = this.getMetrics();

    if (metrics.length === 0) {
      logger.info('No performance metrics recorded');
      return;
    }

    logger.info('📊 Performance Summary:');
    logger.info('='.repeat(60));

    const totalTime = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);

    for (const metric of metrics) {
      const percentage = (((metric.duration || 0) / totalTime) * 100).toFixed(1);
      logger.info(
        `${metric.operation.padEnd(40)} ${metric.duration?.toFixed(2).padStart(8)}ms (${percentage.padStart(5)}%)`
      );
    }

    logger.info('='.repeat(60));
    logger.info(`Total: ${totalTime.toFixed(2)}ms`);
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

/**
 * Decorator for automatic performance monitoring
 */
export function monitored(operation: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const fullOperation = `${target.constructor.name}.${operation || propertyKey}`;
      perfMonitor.start(fullOperation);

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        perfMonitor.end(fullOperation);
      }
    };

    return descriptor;
  };
}

/**
 * Memory-efficient cache with LRU eviction
 */
export class LRUCache<K, V> {
  private cache: Map<K, { value: V; lastAccess: number }>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Update access time
    entry.lastAccess = Date.now();
    return entry.value;
  }

  set(key: K, value: V): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      lastAccess: Date.now(),
    });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private evictOldest(): void {
    let oldestKey: K | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Batching utility for expensive operations
 */
export class OperationBatcher<T, R> {
  private queue: Array<{
    input: T;
    resolve: (result: R) => void;
    reject: (error: Error) => void;
  }> = [];
  private batchSize: number;
  private timeout: NodeJS.Timeout | null = null;
  private processing: boolean = false;

  constructor(
    private processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = 10,
    private maxWaitMs: number = 50
  ) {
    this.batchSize = batchSize;
  }

  async add(input: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ input, resolve, reject });

      // Process if batch is full
      if (this.queue.length >= this.batchSize) {
        this.processBatch();
      } else {
        // Schedule batch processing
        this.scheduleProcessing();
      }
    });
  }

  private scheduleProcessing(): void {
    if (this.timeout) return;

    this.timeout = setTimeout(() => {
      this.processBatch();
    }, this.maxWaitMs);
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    // Clear timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    this.processing = true;

    // Take batch from queue
    const batch = this.queue.splice(0, this.batchSize);
    const inputs = batch.map((item) => item.input);

    try {
      const results = await this.processor(inputs);

      // Resolve all promises
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises
      batch.forEach((item) => {
        item.reject(error as Error);
      });
    } finally {
      this.processing = false;

      // Process next batch if queue has items
      if (this.queue.length > 0) {
        setImmediate(() => this.processBatch());
      }
    }
  }
}

/**
 * Object pool for reducing GC pressure
 */
export class ObjectPool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();

  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    initialSize: number = 10
  ) {
    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }

  acquire(): T {
    let obj: T;

    if (this.available.length > 0) {
      obj = this.available.pop()!;
    } else {
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      throw new Error('Object not acquired from this pool');
    }

    this.inUse.delete(obj);
    this.reset(obj);
    this.available.push(obj);
  }

  clear(): void {
    this.available = [];
    this.inUse.clear();
  }

  stats(): { available: number; inUse: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
    };
  }
}
