// src/lib/renderSchedulerDeviceAware.ts
// 기기 성능을 감지하고 그에 맞는 최적화를 적용하는 적응형 스케줄러

export type RenderJob = {
  id: string;
  priority: number;
  run: () => Promise<void>;
  cancel?: () => void;
};

// 기기 성능 티어
export type DeviceTier = 'low' | 'medium' | 'high';

// 티어별 설정
type TierConfig = {
  concurrency: number;      // 동시 렌더 상한 K
  ioDebounceMs: number;     // IO 콜백 디바운스 시간
  viewportMarginVh: number; // viewport margin (vh 단위)
  description: string;
};

const TIER_CONFIGS: Record<DeviceTier, TierConfig> = {
  low: {
    concurrency: 1,
    ioDebounceMs: 200,
    viewportMarginVh: 25,
    description: '저성능 기기 (코어 ≤2, 메모리 ≤2GB 또는 초기 렌더 느림)'
  },
  medium: {
    concurrency: 3,
    ioDebounceMs: 100,
    viewportMarginVh: 35,
    description: '중성능 기기 (코어 3-4, 메모리 3-4GB)'
  },
  high: {
    concurrency: 5,
    ioDebounceMs: 0,
    viewportMarginVh: 50,
    description: '고성능 기기 (코어 ≥5, 메모리 ≥5GB 또는 초기 렌더 빠름)'
  }
};

class DeviceAwareRenderScheduler {
  private K = 5;
  private inFlight = 0;
  private queue: RenderJob[] = [];
  private running = new Map<string, RenderJob>();
  private enqueued = new Set<string>();
  private completed = new Set<string>();
  
  // 기기 성능 관련
  private deviceTier: DeviceTier = 'medium';
  private config: TierConfig = TIER_CONFIGS.medium;
  
  // 디바운스 관련
  private ioDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.detectDeviceTier();
    this.applyTierConfig();
  }

  // 기기 성능 티어 감지
  private detectDeviceTier(): DeviceTier {
    // 서버 사이드에서는 기본값 반환
    if (typeof window === 'undefined') {
      this.deviceTier = 'medium';
      return 'medium';
    }

    const scores: number[] = [];
    
    // 1. CPU 코어 수 평가 (가중치: 40%)
    const cores = navigator.hardwareConcurrency || 4;
    let coreScore = 0;
    if (cores >= 8) coreScore = 100;
    else if (cores >= 6) coreScore = 80;
    else if (cores >= 4) coreScore = 60;
    else if (cores >= 2) coreScore = 30;
    else coreScore = 10;
    scores.push(coreScore * 0.4);
    
    // 2. 메모리 평가 (가중치: 30%, Chrome만 지원)
    const memory = (navigator as any).deviceMemory;
    if (memory !== undefined) {
      let memScore = 0;
      if (memory >= 8) memScore = 100;
      else if (memory >= 4) memScore = 70;
      else if (memory >= 2) memScore = 40;
      else memScore = 20;
      scores.push(memScore * 0.3);
    } else {
      // 메모리 정보 없으면 중립 점수
      scores.push(50 * 0.3);
    }
    
    // 3. Connection 타입 평가 (가중치: 10%)
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
      const effectiveType = conn.effectiveType;
      let connScore = 0;
      if (effectiveType === '4g') connScore = 100;
      else if (effectiveType === '3g') connScore = 60;
      else if (effectiveType === '2g') connScore = 30;
      else connScore = 50;
      scores.push(connScore * 0.1);
    } else {
      scores.push(50 * 0.1);
    }
    
    // 4. User Agent 기반 모바일/데스크톱 (가중치: 20%)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /iPad|Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent);
    let deviceScore = 0;
    if (!isMobile && !isTablet) deviceScore = 80; // 데스크톱
    else if (isTablet) deviceScore = 60;          // 태블릿
    else deviceScore = 40;                        // 모바일
    scores.push(deviceScore * 0.2);
    
    // 총점 계산
    const totalScore = scores.reduce((sum, s) => sum + s, 0);
    
    // 티어 결정
    let tier: DeviceTier;
    if (totalScore >= 70) tier = 'high';
    else if (totalScore >= 45) tier = 'medium';
    else tier = 'low';
    
    console.log(`[Device-Aware Scheduler] 기기 성능 감지 완료`);
    console.log(`  - CPU 코어: ${cores}개`);
    console.log(`  - 메모리: ${memory !== undefined ? memory + 'GB' : '알 수 없음'}`);
    console.log(`  - 네트워크: ${conn?.effectiveType || '알 수 없음'}`);
    console.log(`  - 기기 타입: ${isMobile ? '모바일' : isTablet ? '태블릿' : '데스크톱'}`);
    console.log(`  - 총점: ${totalScore.toFixed(1)}/100`);
    console.log(`  - 티어: ${tier.toUpperCase()}`);
    
    this.deviceTier = tier;
    return tier;
  }

  // 티어별 설정 적용
  private applyTierConfig() {
    this.config = TIER_CONFIGS[this.deviceTier];
    this.K = this.config.concurrency;
    
    console.log(`[Device-Aware Scheduler] 티어별 설정 적용`);
    console.log(`  - 동시 렌더 상한 (K): ${this.config.concurrency}`);
    console.log(`  - IO 디바운스: ${this.config.ioDebounceMs}ms`);
    console.log(`  - Viewport Margin: ${this.config.viewportMarginVh}vh`);
    console.log(`  - 설명: ${this.config.description}`);
  }

  // Getter 메서드들
  getConcurrency() { return this.K; }
  getInFlight() { return this.inFlight; }
  getQueueLength() { return this.queue.length; }
  getDeviceTier() { return this.deviceTier; }
  getConfig() { return { ...this.config }; }
  getIODebounceMs() { return this.config.ioDebounceMs; }
  getViewportMarginVh() { return this.config.viewportMarginVh; }

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

  // IO 콜백용 디바운스 래퍼
  // 저성능 기기에서 스크롤/리사이즈 이벤트 처리 시 사용
  debounceIOCallback(callback: () => void) {
    // 디바운스가 0이면 즉시 실행 (고성능 기기)
    if (this.config.ioDebounceMs === 0) {
      callback();
      return;
    }

    // 디바운스 적용
    if (this.ioDebounceTimer) {
      clearTimeout(this.ioDebounceTimer);
    }
    
    this.ioDebounceTimer = setTimeout(() => {
      callback();
      this.ioDebounceTimer = null;
    }, this.config.ioDebounceMs);
  }

  // IO 콜백 즉시 실행 (디바운스 취소)
  flushIOCallback() {
    if (this.ioDebounceTimer) {
      clearTimeout(this.ioDebounceTimer);
      this.ioDebounceTimer = null;
    }
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

  // 초기 렌더링 성능 측정 및 티어 재평가
  // PDF 첫 페이지 렌더링 후 호출하여 실제 성능 기반으로 티어 조정
  measureInitialRenderPerformance(renderTimeMs: number) {
    console.log(`[Device-Aware Scheduler] 초기 렌더 성능 측정: ${renderTimeMs.toFixed(1)}ms`);
    
    let performanceTier: DeviceTier;
    
    // 초기 렌더링 시간 기반 티어 판단
    if (renderTimeMs < 100) performanceTier = 'high';       // 100ms 미만 = 고성능
    else if (renderTimeMs < 250) performanceTier = 'medium'; // 250ms 미만 = 중성능
    else performanceTier = 'low';                            // 250ms 이상 = 저성능
    
    // 현재 티어와 다르면 조정
    if (performanceTier !== this.deviceTier) {
      const oldTier = this.deviceTier;
      
      // 더 보수적으로: 둘 중 낮은 티어 선택
      if (performanceTier === 'low' || this.deviceTier === 'low') {
        this.deviceTier = 'low';
      } else if (performanceTier === 'medium' || this.deviceTier === 'medium') {
        this.deviceTier = 'medium';
      } else {
        this.deviceTier = 'high';
      }
      
      console.log(`[Device-Aware Scheduler] 티어 재평가: ${oldTier} → ${this.deviceTier} (실제 성능 기반)`);
      this.applyTierConfig();
    }
  }
}

export const renderSchedulerDeviceAware = new DeviceAwareRenderScheduler();

/* ------------------------------------------------------------------
   🎯 Device-Aware 적응형 스케줄러
   
   특징:
   1. 기기 성능 자동 감지 (CPU, 메모리, 네트워크, 기기 타입)
   2. 티어별 최적화 설정 (Low/Medium/High)
   3. 저성능 기기에서 IO 콜백 디바운스 적용
   4. 초기 렌더링 성능 측정으로 실시간 티어 조정
   
   사용법:
   - 기본: renderScheduler와 동일하게 enqueue() 사용
   - IO 이벤트: debounceIOCallback()으로 스크롤/리사이즈 처리
   - 성능 측정: measureInitialRenderPerformance()로 티어 재평가
   - 설정 조회: getConfig(), getViewportMarginVh() 등
------------------------------------------------------------------- */

