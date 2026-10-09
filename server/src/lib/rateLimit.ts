type Bucket = { hits: number[]; };

/** Compteur en mémoire : une seule instance Preppr par dossier de données. */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  isBlocked(key: string, limit: number, windowMs: number): boolean {
    return this.prune(key, windowMs).length >= limit;
  }

  record(key: string, windowMs: number): void {
    const hits = this.prune(key, windowMs);
    hits.push(Date.now());
    this.buckets.set(key, { hits });
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private prune(key: string, windowMs: number): number[] {
    const now = Date.now();
    const hits = (this.buckets.get(key)?.hits ?? []).filter((at) => now - at < windowMs);
    this.buckets.set(key, { hits });
    return hits;
  }
}
