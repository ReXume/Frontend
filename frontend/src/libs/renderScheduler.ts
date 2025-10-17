// src/lib/renderScheduler.ts
export type RenderJob = {
  id: string;                       // 고유 ID (예: "page-12")
  priority: number;                 // 숫자 작을수록 먼저
  run: () => Promise<void>;         // 실제 렌더 실행
  cancel?: () => void;              // 진행 중인 렌더 취소(가능하면)
};

class RenderScheduler {
  private K = 3;                    // 동시 렌더 상한 (필요 시 3으로)
  private inFlight = 0;
  private queue: RenderJob[] = [];
  private running = new Map<string, RenderJob>();
  private enqueued = new Set<string>();
  private completed = new Set<string>();

  setConcurrency(k: number) {
    this.K = Math.max(1, k);
    this.schedule();
  }

  enqueue(job: RenderJob) {
    // 이미 완료된 작업은 스킵
    if (this.completed.has(job.id)) return;
    // 이미 큐에 있거나 실행 중인 작업은 스킵
    if (this.enqueued.has(job.id) || this.running.has(job.id)) return;
    
    this.enqueued.add(job.id);
    this.queue.push(job);
    // 우선순위 낮은 값 먼저 (viewport 근접도가 낮을수록 높은 우선순위로 정의하면 내림/오름 중 하나 맞춰줘야 함)
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
    // 큐에 있으면 제거
    this.queue = this.queue.filter(j => j.id !== id);
    this.enqueued.delete(id);
    // 실행 중이면 취소 요청
    const running = this.running.get(id);
    if (running && running.cancel) {
      try { running.cancel(); } catch {}
    }
    // completed에서도 제거 (재렌더링 가능하도록)
    this.completed.delete(id);
  }

  private schedule() {
    while (this.inFlight < this.K && this.queue.length) {
      const job = this.queue.shift()!;
      this.enqueued.delete(job.id);
      this.running.set(job.id, job);
      this.inFlight++;

      job.run()
        .then(() => {
          // 성공적으로 완료된 작업 기록
          this.completed.add(job.id);
        })
        .catch(() => {
          // 에러 발생 시 completed에 추가하지 않음 (재시도 가능)
        })
        .finally(() => {
          this.running.delete(job.id);
          this.inFlight--;
          this.schedule();
        });
    }
  }
}

export const renderScheduler = new RenderScheduler();
