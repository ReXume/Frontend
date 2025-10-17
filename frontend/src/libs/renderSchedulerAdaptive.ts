export type RenderJob = {
  id: string;
  priority: number;
  run: () => Promise<void>;
  cancel?: () => void;
};

class RenderScheduler {
  private K = 5;
  private inFlight = 0;
  private queue: RenderJob[] = [];
  private running = new Map<string, RenderJob>();
  private enqueued = new Set<string>();
  private completed = new Set<string>();

  getConcurrency() { return this.K; }
  getInFlight() { return this.inFlight; }
  getQueueLength() { return this.queue.length; }

  setConcurrency(k: number) {
    const next = Math.max(1, k);
    if (next === this.K) return;
    this.K = next;
    this.schedule();
  }

  enqueue(job: RenderJob) {
    if (this.completed.has(job.id)) return;
    if (this.enqueued.has(job.id) || this.running.has(job.id)) return;

    this.enqueued.add(job.id);
    this.queue.push(job);
    this.queue.sort((a, b) => a.priority - b.priority);
    this.schedule();
  }

  bumpPriority(id: string, newPriority: number) {
    const q = this.queue.find(j => j.id === id);
    if (q) {
      q.priority = newPriority;
      this.queue.sort((a, b) => a.priority - b.priority);
    }
  }

  cancel(id: string) {
    this.queue = this.queue.filter(j => j.id !== id);
    this.enqueued.delete(id);
    const running = this.running.get(id);
    if (running && running.cancel) {
      try { running.cancel(); } catch {}
    }
    this.completed.delete(id);
  }

  private schedule() {
    while (this.inFlight < this.K && this.queue.length) {
      const job = this.queue.shift()!;
      this.enqueued.delete(job.id);
      this.running.set(job.id, job);
      this.inFlight++;

      job.run()
        .then(() => this.completed.add(job.id))
        .catch(() => {})
        .finally(() => {
          this.running.delete(job.id);
          this.inFlight--;
          this.schedule();
        });
    }
  }
}

export const renderSchedulerAdaptive = new RenderScheduler();

/* ------------------------------------------------------------------
   ✅ Long Task 비율 기반 동시 렌더 상한 자동 조절 (적응형)
   - 보호(내림): longtaskPct > 2 % → K - 1
   - 상승(보수): longtaskPct < 0.5 % → K + 1
   - 2 초 쿨다운, 0.5 초 간격, 1 ≤ K ≤ 9
------------------------------------------------------------------- */
(function autoAdaptiveK(scheduler: RenderScheduler) {
  const K_MIN = 1;
  const K_MAX = 9;
  const COOLDOWN_MS = 2000;
  const POLL_MS = 500;
  const LOWER_THRESH = 0.02;
  const RAISE_THRESH = 0.005;

  let longtaskPct = 0;
  const entries: PerformanceEntry[] = [];

  try {
    // @ts-ignore
    const po = new PerformanceObserver((list) => entries.push(...list.getEntries()));
    // @ts-ignore
    po.observe({ entryTypes: ["longtask"] });
  } catch {
    // 지원 안 해도 안전하게 무시
  }

  const ltTimer = setInterval(() => {
    const now = performance.now();
    const win = 5000;
    const recent = entries.filter(e => now - e.startTime <= win) as any[];
    const blocked = recent.reduce((s, e) => s + e.duration, 0);
    longtaskPct = Math.min(1, blocked / win);
  }, 1000);

  let lastAdj = 0;
  const loop = setInterval(() => {
    const now = performance.now();
    if (now - lastAdj < COOLDOWN_MS) return;

    const k = scheduler.getConcurrency();
    let desired = k;

    if (longtaskPct > LOWER_THRESH) desired = k - 1;      // 과부하 방어
    else if (longtaskPct < RAISE_THRESH) desired = k + 1; // 여유 상승

    desired = Math.max(K_MIN, Math.min(K_MAX, desired));
    if (desired !== k) {
      scheduler.setConcurrency(desired);
      lastAdj = now;
      console.log(`[적응형 스케줄러] K ${k} → ${desired} (Long Task: ${(longtaskPct*100).toFixed(2)}%)`);
    }
  }, POLL_MS);

  if (typeof window !== 'undefined') {
    window.addEventListener("beforeunload", () => {
      clearInterval(loop);
      clearInterval(ltTimer);
    });
  }
})(renderSchedulerAdaptive);

