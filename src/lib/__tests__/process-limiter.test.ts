// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ProcessLimiter } from '../process-limiter';

describe('per-process circuit breaker', () => {
  it('bounds concurrency, counts attempts and releases only once', () => {
    const limiter = new ProcessLimiter(2, 1, 1000);
    const first = limiter.acquire(100);
    expect('release' in first).toBe(true);
    expect(limiter.acquire(100)).toEqual({ retryAfter: 1 });
    if ('release' in first) { first.release(); first.release(); }
    const second = limiter.acquire(101);
    expect('release' in second).toBe(true);
    if ('release' in second) second.release();
    expect(limiter.acquire(102)).toEqual({ retryAfter: 1 });
    expect('release' in limiter.acquire(1100)).toBe(true);
  });
  it('does not forget active requests when a window rolls over', () => {
    const limiter = new ProcessLimiter(1, 1, 1000);
    const first = limiter.acquire(100);
    expect(limiter.acquire(1100)).toEqual({ retryAfter: 1 });
    if ('release' in first) first.release();
    expect('release' in limiter.acquire(1100)).toBe(true);
  });
});
