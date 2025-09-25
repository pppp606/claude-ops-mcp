import { SessionCache } from '../session-cache';

describe('SessionCache', () => {
  let cache: SessionCache;

  beforeEach(() => {
    cache = new SessionCache();
  });

  describe('cache operations', () => {
    it('should store and retrieve session info by UID', () => {
      const uid = '550e8400-e29b-41d4-a716-446655440000';
      const sessionInfo = {
        sessionFile: '/Users/test/.claude/projects/abc123/session-789.jsonl',
        projectHash: 'abc123',
        sessionId: 'session-789',
      };

      cache.set(uid, sessionInfo);
      const retrieved = cache.get(uid);

      expect(retrieved).toEqual(sessionInfo);
    });

    it('should return null for non-existent UID', () => {
      const result = cache.get('non-existent-uid');
      expect(result).toBeNull();
    });

    it('should update existing cache entry', () => {
      const uid = '550e8400-e29b-41d4-a716-446655440000';
      const sessionInfo1 = {
        sessionFile: '/Users/test/.claude/projects/abc123/session-789.jsonl',
        projectHash: 'abc123',
        sessionId: 'session-789',
      };
      const sessionInfo2 = {
        sessionFile: '/Users/test/.claude/projects/def456/session-999.jsonl',
        projectHash: 'def456',
        sessionId: 'session-999',
      };

      cache.set(uid, sessionInfo1);
      cache.set(uid, sessionInfo2);

      expect(cache.get(uid)).toEqual(sessionInfo2);
    });

    it('should check if UID exists in cache', () => {
      const uid = '550e8400-e29b-41d4-a716-446655440000';
      const sessionInfo = {
        sessionFile: '/Users/test/.claude/projects/abc123/session-789.jsonl',
        projectHash: 'abc123',
        sessionId: 'session-789',
      };

      expect(cache.has(uid)).toBe(false);

      cache.set(uid, sessionInfo);

      expect(cache.has(uid)).toBe(true);
    });

    it('should clear the cache', () => {
      const uid1 = 'uid-1';
      const uid2 = 'uid-2';
      const sessionInfo = {
        sessionFile: '/Users/test/.claude/projects/abc123/session-789.jsonl',
        projectHash: 'abc123',
        sessionId: 'session-789',
      };

      cache.set(uid1, sessionInfo);
      cache.set(uid2, sessionInfo);

      expect(cache.has(uid1)).toBe(true);
      expect(cache.has(uid2)).toBe(true);

      cache.clear();

      expect(cache.has(uid1)).toBe(false);
      expect(cache.has(uid2)).toBe(false);
    });

    it('should delete specific cache entry', () => {
      const uid1 = 'uid-1';
      const uid2 = 'uid-2';
      const sessionInfo = {
        sessionFile: '/Users/test/.claude/projects/abc123/session-789.jsonl',
        projectHash: 'abc123',
        sessionId: 'session-789',
      };

      cache.set(uid1, sessionInfo);
      cache.set(uid2, sessionInfo);

      cache.delete(uid1);

      expect(cache.has(uid1)).toBe(false);
      expect(cache.has(uid2)).toBe(true);
    });
  });

  describe('cache expiration', () => {
    it('should expire cache entries after TTL', () => {
      jest.useFakeTimers();

      const ttlMs = 15 * 60 * 1000; // 15 minutes
      const cacheWithTTL = new SessionCache(ttlMs);

      const uid = '550e8400-e29b-41d4-a716-446655440000';
      const sessionInfo = {
        sessionFile: '/Users/test/.claude/projects/abc123/session-789.jsonl',
        projectHash: 'abc123',
        sessionId: 'session-789',
      };

      cacheWithTTL.set(uid, sessionInfo);
      expect(cacheWithTTL.get(uid)).toEqual(sessionInfo);

      // Advance time by 14 minutes - should still be in cache
      jest.advanceTimersByTime(14 * 60 * 1000);
      expect(cacheWithTTL.get(uid)).toEqual(sessionInfo);

      // Advance time by 2 more minutes (total 16 minutes) - should be expired
      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(cacheWithTTL.get(uid)).toBeNull();

      jest.useRealTimers();
    });

    it('should refresh TTL when entry is updated', () => {
      jest.useFakeTimers();

      const ttlMs = 15 * 60 * 1000; // 15 minutes
      const cacheWithTTL = new SessionCache(ttlMs);

      const uid = '550e8400-e29b-41d4-a716-446655440000';
      const sessionInfo = {
        sessionFile: '/Users/test/.claude/projects/abc123/session-789.jsonl',
        projectHash: 'abc123',
        sessionId: 'session-789',
      };

      cacheWithTTL.set(uid, sessionInfo);

      // Advance time by 14 minutes
      jest.advanceTimersByTime(14 * 60 * 1000);

      // Update the entry - this should refresh the TTL
      cacheWithTTL.set(uid, sessionInfo);

      // Advance time by another 14 minutes (total 28 minutes from start)
      jest.advanceTimersByTime(14 * 60 * 1000);

      // Entry should still be in cache because TTL was refreshed
      expect(cacheWithTTL.get(uid)).toEqual(sessionInfo);

      jest.useRealTimers();
    });
  });

  describe('cache statistics', () => {
    it('should track cache hits and misses', () => {
      const uid1 = 'uid-1';
      const uid2 = 'uid-2';
      const sessionInfo = {
        sessionFile: '/Users/test/.claude/projects/abc123/session-789.jsonl',
        projectHash: 'abc123',
        sessionId: 'session-789',
      };

      cache.set(uid1, sessionInfo);

      // Cache hit
      cache.get(uid1);
      // Cache miss
      cache.get(uid2);
      // Another cache hit
      cache.get(uid1);

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should return zero hit rate when no requests made', () => {
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});
