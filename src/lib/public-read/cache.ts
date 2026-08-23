/** In-process TTL for allowlisted public reads (Phase 6). Per-instance only. */
export const PUBLIC_READ_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAtMs: number;
  data: unknown[];
  truncated: boolean;
};

const cache = new Map<string, CacheEntry>();

export function publicReadCacheKey(table: string, limit: number): string {
  return `${table}:${limit}`;
}

export function publicReadCacheKeyAll(table: string): string {
  return `${table}:all`;
}

export function getPublicReadCacheEntry(
  key: string,
  nowMs = Date.now(),
): { data: unknown[]; truncated: boolean } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (nowMs >= entry.expiresAtMs) {
    cache.delete(key);
    return null;
  }
  return {
    data: entry.data.slice(),
    truncated: entry.truncated,
  };
}

export function setPublicReadCacheEntry(
  key: string,
  value: { data: unknown[]; truncated: boolean },
  nowMs = Date.now(),
  ttlMs = PUBLIC_READ_CACHE_TTL_MS,
): void {
  cache.set(key, {
    expiresAtMs: nowMs + ttlMs,
    data: value.data.slice(),
    truncated: value.truncated,
  });
}

/** Test helper — clears all cached public reads. */
export function resetPublicReadCacheForTests(): void {
  cache.clear();
}
