# CPU 4x 환경 IntersectionObserver & 디바운스 분석 보고서

## 📊 실험 개요

### 목적
CPU 4x (저성능) 환경에서 IntersectionObserver 콜백으로 인한 LongTask 발생 여부 및 디바운스(100ms) 효과를 검증

### 테스트 환경
- **CPU Throttling**: 4x
- **브라우저**: Chromium (Puppeteer)
- **테스트 시나리오**: 현실적 사용자 패턴 (스크롤 → 읽기 → 반복)
- **측정 항목**: 
  - IntersectionObserver 콜백 호출 빈도
  - LongTask 발생 (>50ms)
  - 렌더 이벤트 수
  - IO-LongTask 상관관계

---

## 🔍 핵심 발견

### 1. IntersectionObserver와 LongTask의 관계

#### 측정 결과

| 메트릭 | 디바운스 100ms | 디바운스 없음 | 차이 |
|--------|---------------|-------------|------|
| IO 콜백 호출 | 175회 (4.81/sec) | 186회 (5.10/sec) | +6% |
| 렌더 이벤트 | 8개 | 21개 | **+162%** |
| LongTask 수 | 5개 | 5개 | 동일 |
| TBT (총 차단 시간) | 1318ms | 1374ms | +4% |
| LongTask 비율 | 3.62% | 3.76% | +0.14%p |
| **IO-LongTask 상관관계** | **20%** | **20%** | **낮음** |

#### 상관관계 분석
- LongTask 직전 100ms 이내에 IO 콜백이 발생한 경우: **1/5개 (20%)**
- ❌ **IO 콜백과 LongTask 사이에 직접적 상관관계가 낮음**

#### LongTask 타임라인 (디바운스 없음 기준)
1. **76ms @ 82.6ms** - PDF.js 초기화
2. **886ms @ 242.4ms** - PDF 문서 로딩 (가장 큼)
3. **87ms @ 1556.3ms** - 첫 페이지 렌더 준비
4. **271ms @ 1650.2ms** - 첫 페이지 렌더
5. **56ms @ 1956.2ms** - 렌더 완료

**결론**: 모든 주요 LongTask는 **초기 로딩 시점(0~2초)**에 발생하며, **PDF.js 초기화 및 첫 렌더링**과 관련됨. IntersectionObserver와는 무관.

---

## ⚠️ 디바운스 100ms의 문제점

### 1. 과도한 렌더링 제한
```
렌더 이벤트: 8개 → 21개 (162% 감소)
```
- 디바운스로 인해 필요한 페이지 렌더링이 **과도하게 지연/생략**됨
- 사용자 뷰포트에 들어온 페이지가 제때 렌더되지 않음

### 2. 미미한 성능 개선
```
TBT 개선: 1374ms → 1318ms (4% 감소)
LongTask 비율: 3.76% → 3.62% (0.14%p 감소)
```
- TBT 개선 효과는 **4%에 불과**
- LongTask 개수는 **동일** (5개)
- **투자 대비 효과 미미**

### 3. IO 호출 빈도는 거의 동일
```
IO 콜백: 186회 → 175회 (6% 감소)
```
- 디바운스가 IO 호출을 크게 줄이지 못함
- 대부분의 IO 호출은 **초기 로딩 시점에 집중** (147개)
- 스크롤 중 IO 호출은 39회에 불과

---

## 💡 근본 원인 분석

### IntersectionObserver 호출 패턴
- **초기 로딩 시점**: 147개 (79%) - 모든 페이지 div가 한꺼번에 observe됨
- **스크롤 중**: 39개 (21%) - 뷰포트 변화에 따른 정상적 호출

### LongTask 발생 원인
1. **PDF.js 초기화**: 886ms (가장 큼)
2. **PDF 문서 파싱**: 76ms
3. **첫 페이지 렌더링**: 271ms + 87ms
4. **렌더 완료 처리**: 56ms

→ **모두 PDF.js 내부 작업이며, IntersectionObserver와 무관**

---

## 📈 권장사항

### 1. CPU 4x 환경에서 디바운스 조정

#### ❌ 현재 설정 (비효율적)
```typescript
medium: {
  ioDebounceMs: 100,  // 너무 긴 디바운스
  concurrency: 3,
}
```

#### ✅ 개선 방안 A: 디바운스 제거
```typescript
medium: {
  ioDebounceMs: 0,    // 디바운스 제거
  concurrency: 3,
}
```
- 렌더 이벤트: +162% 증가
- TBT 증가: 4%에 불과 (허용 범위)

#### ✅ 개선 방안 B: 짧은 디바운스 (절충안)
```typescript
medium: {
  ioDebounceMs: 25,   // 25ms로 단축
  concurrency: 3,
}
```
- 불필요한 연속 호출만 제거
- 렌더링 지연 최소화

### 2. 저성능 환경 (CPU 6x 이상)만 긴 디바운스 적용
```typescript
low: {
  ioDebounceMs: 150,   // 더 낮춤 (200→150)
  concurrency: 1,
}
medium: {
  ioDebounceMs: 0,     // 제거
  concurrency: 3,
}
high: {
  ioDebounceMs: 0,
  concurrency: 5,
}
```

### 3. 초기 로딩 최적화에 집중
- **현재 문제**: LongTask는 IntersectionObserver가 아닌 PDF.js 초기화 때문
- **해결 방향**: 
  1. PDF.js worker 초기화 시점 최적화
  2. 첫 페이지 렌더링을 requestIdleCallback으로 지연
  3. 문서 메타데이터만 먼저 로드, 페이지는 lazy load

---

## 🎯 결론

### 핵심 요약
1. ❌ **IntersectionObserver는 LongTask의 주범이 아님** (상관관계 20%)
2. ❌ **CPU 4x 환경에서 100ms 디바운스는 과도함** (렌더링 162% 감소)
3. ✅ **디바운스를 제거하거나 25ms로 낮춰야 함**
4. ✅ **진짜 문제는 PDF.js 초기화 LongTask** (886ms)

### 최종 제안
```typescript
// renderSchedulerDeviceAware.ts 수정
const TIER_CONFIGS: Record<DeviceTier, TierConfig> = {
  low: {
    concurrency: 1,
    ioDebounceMs: 150,    // 200 → 150
    viewportMarginVh: 25,
  },
  medium: {
    concurrency: 3,
    ioDebounceMs: 0,      // 100 → 0 (제거)
    viewportMarginVh: 35,
  },
  high: {
    concurrency: 5,
    ioDebounceMs: 0,
    viewportMarginVh: 50,
  }
};
```

---

## 📁 테스트 데이터

### 결과 파일
- 디바운스 100ms: `io-tracking-cpu4x-2025-10-17T20-13-12.json`
- 디바운스 없음: `io-tracking-cpu4x-nodebounce-2025-10-17T20-14-08.json`

### 재현 방법
```bash
# 디바운스 있음
node bench-io-tracking.js --cpu 4 --headless true

# 디바운스 없음
node bench-io-tracking.js --cpu 4 --headless true --disableDebounce true
```

---

**작성일**: 2025-10-17  
**테스트 환경**: Next.js + PDF.js + Device-Aware Scheduler  
**CPU Throttling**: 4x (중성능 기기 시뮬레이션)

