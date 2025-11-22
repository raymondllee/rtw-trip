/**
 * Cached Fetch Utility - Wraps fetch() calls with QueryCache
 *
 * Provides caching for REST API endpoints with:
 * - Automatic TTL-based expiration
 * - Request deduplication
 * - Manual cache invalidation
 */

import { queryCache, CacheKeys, CacheInvalidators } from '../firestore/queryCache';

export interface CachedFetchOptions extends RequestInit {
  /** Cache TTL in milliseconds (overrides default) */
  cacheTTL?: number;
  /** Skip cache and force fresh fetch */
  forceRefresh?: boolean;
  /** Cache key (if not provided, uses URL) */
  cacheKey?: string;
}

/**
 * Cached wrapper for fetch() - GET requests only
 * POST/PUT/PATCH/DELETE requests bypass cache
 */
export async function cachedFetch<T = any>(
  url: string,
  options?: CachedFetchOptions
): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();

  // Only cache GET requests
  if (method !== 'GET') {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  }

  const cacheKey = options?.cacheKey || url;
  const ttl = options?.cacheTTL || queryCache.getTTL('document');
  const forceRefresh = options?.forceRefresh || false;

  return queryCache.get(
    cacheKey,
    async () => {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    },
    { ttl, forceRefresh }
  );
}

/**
 * Cached education API helpers
 */
export const cachedEducationAPI = {
  async getStudents(baseUrl: string = 'http://localhost:5001'): Promise<any> {
    return cachedFetch(
      `${baseUrl}/api/education/students`,
      {
        cacheKey: CacheKeys.educationStudents(),
        cacheTTL: queryCache.getTTL('list') // 10 seconds
      }
    );
  },

  async getStudent(studentId: string, baseUrl: string = 'http://localhost:5001'): Promise<any> {
    return cachedFetch(
      `${baseUrl}/api/education/students/${studentId}`,
      {
        cacheKey: CacheKeys.educationStudent(studentId),
        cacheTTL: queryCache.getTTL('document') // 5 minutes
      }
    );
  },

  async getDestinations(baseUrl: string = 'http://localhost:5001'): Promise<any> {
    return cachedFetch(
      `${baseUrl}/api/education/destinations`,
      {
        cacheKey: CacheKeys.educationDestinations(),
        cacheTTL: queryCache.getTTL('document') // 5 minutes
      }
    );
  },

  async getStudentDashboard(studentId: string, baseUrl: string = 'http://localhost:5001'): Promise<any> {
    return cachedFetch(
      `${baseUrl}/api/education/students/${studentId}/dashboard`,
      {
        cacheKey: CacheKeys.educationStudentDashboard(studentId),
        cacheTTL: queryCache.getTTL('list') // 10 seconds
      }
    );
  }
};

/**
 * Cached cost API helpers
 */
export const cachedCostAPI = {
  async researchCost(
    origin: string,
    destination: string,
    dateStr: string,
    baseUrl: string
  ): Promise<any> {
    const cacheKey = CacheKeys.costResearch(origin, destination, dateStr);

    return cachedFetch(
      `${baseUrl}/api/costs/research`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, date: dateStr }),
        cacheKey,
        cacheTTL: 10 * 60 * 1000 // 10 minutes - cost data changes infrequently
      }
    );
  }
};

/**
 * Cached transport API helpers
 */
export const cachedTransportAPI = {
  async researchTransport(
    origin: string,
    destination: string,
    dateStr: string,
    baseUrl: string
  ): Promise<any> {
    const cacheKey = CacheKeys.transportResearch(origin, destination, dateStr);

    return cachedFetch(
      `${baseUrl}/api/transport/research`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, date: dateStr }),
        cacheKey,
        cacheTTL: 10 * 60 * 1000 // 10 minutes
      }
    );
  },

  async syncSegments(scenarioId: string, segments: any[], baseUrl: string): Promise<any> {
    const response = await fetch(`${baseUrl}/api/transport-segments/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId, segments })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Invalidate transport cache for this scenario
    CacheInvalidators.transportSegments(scenarioId);

    return result;
  }
};

/**
 * Cached place API helpers
 */
export const cachedPlaceAPI = {
  async getPlaceDetails(placeId: string, baseUrl: string): Promise<any> {
    return cachedFetch(
      `${baseUrl}/api/places/details/${encodeURIComponent(placeId)}`,
      {
        cacheKey: CacheKeys.placeDetails(placeId),
        cacheTTL: 60 * 60 * 1000 // 1 hour - place data rarely changes
      }
    );
  }
};
