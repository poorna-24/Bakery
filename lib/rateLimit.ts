/**
 * At most `limit` hits per key within `windowMs`. In memory, so per server
 * instance: on Vercel that makes it a speed bump for a script hammering the
 * order button, not a wall — which is all a bakery menu needs.
 *
 * Generous on purpose. A shop's Wi-Fi puts every customer behind one address,
 * and a table of friends ordering at once must never be turned away.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);

    // Keep the map from growing without end: drop keys that have gone quiet.
    if (hits.size > 5000) {
      for (const [other, times] of hits) {
        if (times.every((at) => now - at >= windowMs)) hits.delete(other);
      }
    }
    return true;
  };
}

/**
 * Who is asking, for rate limiting. x-real-ip first: Vercel sets it from the
 * connection itself, where the first x-forwarded-for entry is whatever the
 * client chose to send. Behind no proxy at all both are the client's word —
 * the limit is a speed bump there, not a lock.
 */
export function clientKey(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
