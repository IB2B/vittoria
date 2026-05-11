// Token-bucket rate limiter — 60 calls / minute / token (per §7).

const buckets = new Map<string, { tokens: number; lastRefill: number }>();
const CAPACITY = 60;
const REFILL_PER_MS = CAPACITY / 60_000;

export async function acquire(key: string): Promise<void> {
  while (true) {
    const now = Date.now();
    const bucket = buckets.get(key) ?? { tokens: CAPACITY, lastRefill: now };
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(CAPACITY, bucket.tokens + elapsed * REFILL_PER_MS);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      buckets.set(key, bucket);
      return;
    }

    buckets.set(key, bucket);
    const waitMs = Math.ceil((1 - bucket.tokens) / REFILL_PER_MS);
    await new Promise((r) => setTimeout(r, waitMs));
  }
}
