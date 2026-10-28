/** A coarse per-process circuit breaker. This is not a distributed or per-client limit. */
export class ProcessLimiter {
  private startedAt = 0;
  private attempts = 0;
  private active = 0;

  constructor(private readonly maxAttempts: number, private readonly maxActive: number, private readonly windowMs: number) {}

  acquire(now = Date.now()): { release: () => void } | { retryAfter: number } {
    if (!this.startedAt || now - this.startedAt >= this.windowMs || now < this.startedAt) {
      this.startedAt = now;
      this.attempts = 0;
    }
    if (this.active >= this.maxActive) return { retryAfter: 1 };
    if (this.attempts >= this.maxAttempts) return { retryAfter: Math.max(1, Math.ceil((this.startedAt + this.windowMs - now) / 1000)) };
    this.attempts++;
    this.active++;
    let released = false;
    return { release: () => { if (!released) { released = true; this.active--; } } };
  }
}

export const analysisLimiter = new ProcessLimiter(120, 24, 60_000);
export const apiEntryLimiter = new ProcessLimiter(180, 32, 60_000);
export const providerLimiter = new ProcessLimiter(30, 2, 60_000);
