/**
 * QueryCache - A lightweight caching layer for Firestore queries and API calls
 *
 * Features:
 * - TTL-based expiration
 * - Request deduplication (shares in-flight promises)
 * - Manual invalidation support
 * - Cache statistics for monitoring
 * - Namespace support for different data types
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time-to-live in milliseconds
}

interface InFlightRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
}

export class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private inFlight: Map<string, InFlightRequest<any>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0, size: 0 };

  // Default TTLs (in milliseconds)
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly LIST_TTL = 10 * 1000; // 10 seconds for list queries
  private readonly SESSION_TTL = 30 * 60 * 1000; // 30 minutes for single documents

  // Enable/disable caching globally
  private enabled: boolean = true;

  /**
   * Get data from cache or execute query function if not cached
   */
  async get<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: { ttl?: number; forceRefresh?: boolean } = {}
  ): Promise<T> {
    if (!this.enabled || options.forceRefresh) {
      return this.executeQuery(key, queryFn, options.ttl);
    }

    // Check cache first
    const cached = this.getFromCache<T>(key);
    if (cached !== null) {
      this.stats.hits++;
      return cached;
    }

    // Check if request is already in-flight
    const inFlight = this.inFlight.get(key);
    if (inFlight) {
      // Return the existing promise to deduplicate requests
      return inFlight.promise as Promise<T>;
    }

    this.stats.misses++;
    return this.executeQuery(key, queryFn, options.ttl);
  }

  /**
   * Execute the query function and cache the result
   */
  private async executeQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const promise = queryFn();

    // Store in-flight request to deduplicate concurrent calls
    this.inFlight.set(key, { promise, timestamp: Date.now() });

    try {
      const data = await promise;

      // Cache the result
      this.setCache(key, data, ttl);

      return data;
    } catch (error) {
      // Don't cache errors
      throw error;
    } finally {
      // Remove from in-flight
      this.inFlight.delete(key);
    }
  }

  /**
   * Get data from cache if valid, otherwise return null
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      this.stats.evictions++;
      this.stats.size--;
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with TTL
   */
  private setCache<T>(key: string, data: T, ttl?: number): void {
    const isNewEntry = !this.cache.has(key);

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.DEFAULT_TTL
    });

    if (isNewEntry) {
      this.stats.size++;
    }
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.evictions++;
      this.stats.size--;
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   * Pattern can include wildcards (*)
   */
  invalidatePattern(pattern: string): number {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.stats.evictions++;
        this.stats.size--;
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.stats.evictions += this.cache.size;
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : this.stats.hits / total;
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Get TTL presets for different query types
   */
  getTTL(type: 'list' | 'document' | 'session' | 'default'): number {
    switch (type) {
      case 'list':
        return this.LIST_TTL;
      case 'document':
        return this.DEFAULT_TTL;
      case 'session':
        return this.SESSION_TTL;
      default:
        return this.DEFAULT_TTL;
    }
  }

  /**
   * Batch get multiple keys
   * Returns cached values where available, executes queries for missing entries
   */
  async getBatch<T>(
    keys: string[],
    queryFn: (missingKeys: string[]) => Promise<Map<string, T>>,
    options: { ttl?: number } = {}
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    const missingKeys: string[] = [];

    // Check cache for each key
    for (const key of keys) {
      const cached = this.getFromCache<T>(key);
      if (cached !== null) {
        results.set(key, cached);
        this.stats.hits++;
      } else {
        missingKeys.push(key);
        this.stats.misses++;
      }
    }

    // If all keys found in cache, return early
    if (missingKeys.length === 0) {
      return results;
    }

    // Fetch missing keys in batch
    const freshData = await queryFn(missingKeys);

    // Cache the fresh data
    for (const [key, data] of freshData.entries()) {
      this.setCache(key, data, options.ttl);
      results.set(key, data);
    }

    return results;
  }

  /**
   * Cleanup expired entries (can be called periodically)
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
        this.stats.evictions++;
        this.stats.size--;
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get all cache keys (useful for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Export cache state for debugging
   */
  debug(): any {
    return {
      stats: this.getStats(),
      hitRate: this.getHitRate(),
      keys: this.getKeys(),
      inFlightCount: this.inFlight.size,
      enabled: this.enabled
    };
  }
}

/**
 * Global singleton instance
 */
export const queryCache = new QueryCache();

/**
 * Cache key builders for consistent naming
 */
export const CacheKeys = {
  scenario: (id: string) => `scenario:${id}`,
  scenarioLatest: (id: string) => `scenario:${id}:latest`,
  scenarioVersion: (scenarioId: string, versionNumber: number) =>
    `scenario:${scenarioId}:version:${versionNumber}`,
  scenarioVersionHistory: (scenarioId: string) => `scenario:${scenarioId}:versions`,
  scenarioList: () => 'scenarios:list',
  scenarioSummary: (scenarioId: string, versionNumber: number) =>
    `scenario:${scenarioId}:version:${versionNumber}:summary`,
  educationStudent: (studentId: string) => `education:student:${studentId}`,
  educationStudents: () => 'education:students:list',
  educationCurriculum: (id: string) => `education:curriculum:${id}`,
  educationLocation: (locationId: string) => `education:location:${locationId}`,
  placeDetails: (placeId: string) => `place:${placeId}:details`,
};

/**
 * Cache invalidation helpers
 */
export const CacheInvalidators = {
  scenario: (id: string) => {
    queryCache.invalidatePattern(`scenario:${id}*`);
    // Also invalidate the scenarios list since it contains summary info
    queryCache.invalidate(CacheKeys.scenarioList());
  },

  scenarioVersion: (scenarioId: string, versionNumber?: number) => {
    if (versionNumber !== undefined) {
      queryCache.invalidatePattern(`scenario:${scenarioId}:version:${versionNumber}*`);
    }
    queryCache.invalidate(CacheKeys.scenarioLatest(scenarioId));
    queryCache.invalidate(CacheKeys.scenarioVersionHistory(scenarioId));
  },

  scenarioList: () => {
    queryCache.invalidate(CacheKeys.scenarioList());
  },

  allScenarios: () => {
    queryCache.invalidatePattern('scenario:*');
  },

  education: () => {
    queryCache.invalidatePattern('education:*');
  }
};
