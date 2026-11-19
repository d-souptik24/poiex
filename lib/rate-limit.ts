/**
 * In-memory sliding-window token bucket rate limiter for Vercel Serverless / Node.js.
 *
 * Provides in-process burst and quota protection without external dependencies.
 * Conforms to RFC 6585 with standard X-RateLimit-* and Retry-After headers.
 */

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
  retryAfter: number; // Seconds until reset
  headers: Record<string, string>;
}

export const RATE_LIMIT_TIERS: Record<string, RateLimitOptions> = {
  chat: {
    limit: 15,
    windowMs: 60 * 1000, // 15 requests per minute
  },
  codeCompletion: {
    limit: 40,
    windowMs: 60 * 1000, // 40 requests per minute
  },
};

interface Bucket {
  count: number;
  resetAt: number; // ms
}

const store = new Map<string, Bucket>();

// Periodic cleanup of expired buckets
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

function cleanupStaleBuckets(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of store.entries()) {
    if (now >= bucket.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Check and record a rate-limit allowance for an identifier (e.g. userId or IP).
 * Fails open if an internal error occurs.
 */
export function rateLimit(
  identifier: string,
  tier: "chat" | "codeCompletion" | string,
  customOptions?: Partial<RateLimitOptions>
): RateLimitResult {
  try {
    const now = Date.now();
    cleanupStaleBuckets(now);

    const baseOptions = RATE_LIMIT_TIERS[tier] || { limit: 20, windowMs: 60_000 };
    const limit = customOptions?.limit ?? baseOptions.limit;
    const windowMs = customOptions?.windowMs ?? baseOptions.windowMs;

    const key = `${tier}:${identifier}`;
    let bucket = store.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = {
        count: 1,
        resetAt: now + windowMs,
      };
      store.set(key, bucket);

      const resetSec = Math.ceil(bucket.resetAt / 1000);
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      const remaining = Math.max(0, limit - bucket.count);

      return {
        success: true,
        limit,
        remaining,
        reset: resetSec,
        retryAfter,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": resetSec.toString(),
        },
      };
    }

    if (bucket.count < limit) {
      bucket.count += 1;
      const resetSec = Math.ceil(bucket.resetAt / 1000);
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      const remaining = Math.max(0, limit - bucket.count);

      return {
        success: true,
        limit,
        remaining,
        reset: resetSec,
        retryAfter,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": resetSec.toString(),
        },
      };
    }

    // Rate limit exceeded
    const resetSec = Math.ceil(bucket.resetAt / 1000);
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    return {
      success: false,
      limit,
      remaining: 0,
      reset: resetSec,
      retryAfter,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetSec.toString(),
        "Retry-After": retryAfter.toString(),
      },
    };
  } catch (err) {
    console.error("[RateLimiter] Error during check, failing open:", err);
    return {
      success: true,
      limit: 100,
      remaining: 100,
      reset: Math.ceil((Date.now() + 60_000) / 1000),
      retryAfter: 0,
      headers: {},
    };
  }
}

/**
 * Reset all rate limits (useful in tests).
 */
export function resetRateLimits(): void {
  store.clear();
  lastCleanup = Date.now();
}
