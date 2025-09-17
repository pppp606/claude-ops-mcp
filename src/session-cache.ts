export interface SessionInfo {
  sessionFile: string;
  projectHash: string;
  sessionId: string;
}

interface CacheEntry {
  data: SessionInfo;
  timestamp: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

export class SessionCache {
  private cache: Map<string, CacheEntry>;
  private ttlMs: number;
  private hits: number;
  private misses: number;

  constructor(ttlMs: number = 15 * 60 * 1000) {
    // Default TTL: 15 minutes
    this.cache = new Map();
    this.ttlMs = ttlMs;
    this.hits = 0;
    this.misses = 0;
  }

  set(uid: string, sessionInfo: SessionInfo): void {
    this.cache.set(uid, {
      data: sessionInfo,
      timestamp: Date.now(),
    });
  }

  get(uid: string): SessionInfo | null {
    const entry = this.cache.get(uid);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      // Entry has expired, remove it
      this.cache.delete(uid);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data;
  }

  has(uid: string): boolean {
    const entry = this.cache.get(uid);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      // Entry has expired, remove it
      this.cache.delete(uid);
      return false;
    }

    return true;
  }

  delete(uid: string): void {
    this.cache.delete(uid);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total === 0 ? 0 : this.hits / total;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}