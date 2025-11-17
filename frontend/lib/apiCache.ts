/**
 * API caching and request deduplication system
 * Reduces redundant API calls and improves performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class APICache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    console.log(`📦 Cache hit: ${key}`);
    return entry.data as T;
  }

  /**
   * Set data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const timestamp = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp,
      expiresAt: timestamp + ttl,
    };

    this.cache.set(key, entry);
    console.log(`💾 Cached: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
    console.log(`🗑️  Cache deleted: ${key}`);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️  Cache cleared');
  }

  /**
   * Clear expired cache entries
   */
  clearExpired(): void {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`🗑️  Cleared ${cleared} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Deduplicate concurrent requests to the same endpoint
   * If a request is already in flight, return the existing promise
   */
  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>,
    options: { ttl?: number; forceRefresh?: boolean } = {}
  ): Promise<T> {
    const { ttl = this.defaultTTL, forceRefresh = false } = options;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(key);
    if (pending) {
      console.log(`⏳ Deduplicating request: ${key}`);
      return pending.promise;
    }

    // Create new request
    console.log(`🚀 New request: ${key}`);
    const promise = fn()
      .then((data) => {
        // Cache the result
        this.set(key, data, ttl);
        // Remove from pending
        this.pendingRequests.delete(key);
        return data;
      })
      .catch((error) => {
        // Remove from pending on error
        this.pendingRequests.delete(key);
        throw error;
      });

    // Store as pending
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Invalidate cache by pattern
   * Useful for invalidating related cache entries
   */
  invalidatePattern(pattern: string | RegExp): number {
    let invalidated = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    if (invalidated > 0) {
      console.log(`🗑️  Invalidated ${invalidated} cache entries matching: ${pattern}`);
    }

    return invalidated;
  }
}

// Export singleton instance
export const apiCache = new APICache();

/**
 * Helper function for cached API calls
 */
export async function cachedFetch<T>(
  url: string,
  options?: RequestInit & { cacheKey?: string; ttl?: number; forceRefresh?: boolean }
): Promise<T> {
  const { cacheKey, ttl, forceRefresh, ...fetchOptions } = options || {};
  const key = cacheKey || `${fetchOptions.method || 'GET'}:${url}`;

  return apiCache.deduplicate(
    key,
    async () => {
      const response = await fetch(url, fetchOptions);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    { ttl, forceRefresh }
  );
}

/**
 * Invalidate cache when mutations happen
 * Call this after POST/PUT/DELETE operations
 */
export function invalidateCache(patterns: (string | RegExp)[]) {
  patterns.forEach((pattern) => {
    apiCache.invalidatePattern(pattern);
  });
}

// Clean up expired cache entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    apiCache.clearExpired();
  }, 5 * 60 * 1000);
}

