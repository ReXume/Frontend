export type RenderJob = {
  id: string;
  priority: number;
  run: () => Promise<void>;
  cancel?: () => void;
};

class RenderScheduler {
  private K = 1; // 고정 동시성
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

export const renderSchedulerFixed = new RenderScheduler();

/* ------------------------------------------------------------------
   🔒 고정 K=5 스케줄러 (오토 어댑티브 없음)
   - 동시성 K는 항상 5로 고정
   - 성능 측정 및 비교를 위한 베이스라인
------------------------------------------------------------------- */

