import { PUBLIC_RATE_LIMIT_PER_MINUTE } from "@/lib/public-read/allowlist";

type Bucket = {
  count: number;
  windowStartMs: number;
};

const WINDOW_MS = 60_000;

/** Simple in-memory limiter (per process). Fine for Phase 2; not shared across instances. */
const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number };

export function checkPublicRateLimit(
  key: string,
  limit = PUBLIC_RATE_LIMIT_PER_MINUTE,
  nowMs = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || nowMs - existing.windowStartMs >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartMs: nowMs });
    return { ok: true, remaining: limit - 1 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterMs: WINDOW_MS - (nowMs - existing.windowStartMs),
    };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count };
}

/** Test helper — clears all buckets. */
export function resetPublicRateLimitForTests() {
  buckets.clear();
}
