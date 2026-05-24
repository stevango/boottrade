import { TRPCError } from "@trpc/server";

// Lightweight in-memory sliding-window rate limiter.
// Suitable for a single instance; swap for a shared store (Redis) when scaling out.
type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const hit = buckets.get(key);

  if (!hit || now >= hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (hit.count >= limit) {
    const retryAfter = Math.ceil((hit.resetAt - now) / 1000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Limite de requisições atingido. Tente novamente em ${retryAfter}s.`,
    });
  }

  hit.count += 1;
}

// Opportunistically drop expired buckets so the map does not grow unbounded.
setInterval(() => {
  const now = Date.now();
  buckets.forEach((hit, key) => {
    if (now >= hit.resetAt) buckets.delete(key);
  });
}, 60_000).unref?.();
