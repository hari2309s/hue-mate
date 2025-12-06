import { logger } from './logger';

interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();

  start(operation: string, metadata?: Record<string, any>): void {
    this.metrics.set(operation, {
      operation,
      startTime: performance.now(),
      metadata,
    });
  }

  end(operation?: string): number {
    const key = operation;

    if (!key) {
      logger.warn('Performance monitor: no operation to end');
      return 0;
    }

    const metric = this.metrics.get(key);

    if (!metric) {
      logger.warn(`Performance monitor: operation not found: ${key}`);
      if (process.env.NODE_ENV === 'development') {
        console.log('this.metrics ', this.metrics);
      }
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

export const perfMonitor = new PerformanceMonitor();

/**
 * LRU Cache for memory-efficient caching
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

    entry.lastAccess = Date.now();
    return entry.value;
  }

  set(key: K, value: V): void {
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
