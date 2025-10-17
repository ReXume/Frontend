# 🎯 Device-Aware 렌더 스케줄러

기기 성능을 자동으로 감지하고 최적의 렌더링 전략을 적용하는 적응형 PDF 렌더 스케줄러입니다.

## 📋 개요

실사용자 테스트를 통해 다음과 같은 인사이트를 얻었습니다:

1. **고성능 기기**: K=5, viewport margin=50vh일 때 최적 성능
2. **저성능 기기**: K값을 낮춰도 성능 개선이 제한적
3. **해결책**: IO 콜백(스크롤, 리사이즈 등)에 디바운스를 적용하여 메인 스레드 부하 감소

## 🎯 핵심 기능

### 1. 자동 기기 티어 감지

다음 요소들을 종합하여 기기를 Low/Medium/High 티어로 분류:

- **CPU 코어 수** (`navigator.hardwareConcurrency`)
- **메모리 용량** (`navigator.deviceMemory`, Chrome 지원)
- **네트워크 속도** (`navigator.connection.effectiveType`)
- **기기 타입** (모바일/태블릿/데스크톱)
- **초기 렌더링 성능** (첫 페이지 렌더 시간)

### 2. 티어별 최적화 설정

```typescript
const TIER_CONFIGS = {
  low: {
    concurrency: 1,           // 동시 렌더 1개만
    ioDebounceMs: 200,        // IO 이벤트 200ms 디바운스
    viewportMarginVh: 25,     // viewport 여유 25vh
  },
  medium: {
    concurrency: 3,
    ioDebounceMs: 100,
    viewportMarginVh: 35,
  },
  high: {
    concurrency: 5,           // 실사용자 테스트 기준 최적값
    ioDebounceMs: 50,
    viewportMarginVh: 50,     // 실사용자 테스트 기준 최적값
  }
};
```

### 3. IO 콜백 디바운스

저성능 기기에서 스크롤/리사이즈 이벤트로 인한 과부하를 방지:

```typescript
// IntersectionObserver 콜백에 디바운스 적용
const handleIntersection = (entries) => {
  renderSchedulerDeviceAware.debounceIOCallback(() => {
    entries.forEach((entry) => {
      setIsVisible(entry.isIntersecting);
    });
  });
};
```

### 4. 실시간 티어 재평가

첫 페이지 렌더링 성능을 측정하여 실제 성능에 맞게 티어 조정:

```typescript
// 첫 페이지 렌더링 후
renderSchedulerDeviceAware.measureInitialRenderPerformance(renderTimeMs);
```

## 🚀 사용법

### 기본 사용

```typescript
import { renderSchedulerDeviceAware } from '@/libs/renderSchedulerDeviceAware';

// 1. 렌더 작업 등록 (기존 스케줄러와 동일)
renderSchedulerDeviceAware.enqueue({
  id: 'page-1',
  priority: 0,
  run: async () => {
    // 렌더링 로직
  },
});

// 2. 기기 설정 조회
const config = renderSchedulerDeviceAware.getConfig();
console.log(`K: ${config.concurrency}, 디바운스: ${config.ioDebounceMs}ms`);
```

### IO 이벤트 디바운스

```typescript
// IntersectionObserver 등 IO 이벤트에 디바운스 적용
useEffect(() => {
  const handleIntersection = (entries) => {
    renderSchedulerDeviceAware.debounceIOCallback(() => {
      // 디바운스된 콜백
      entries.forEach((entry) => {
        setIsVisible(entry.isIntersecting);
      });
    });
  };

  const observer = new IntersectionObserver(handleIntersection, {
    rootMargin: `${renderSchedulerDeviceAware.getViewportMarginVh()}vh 0px`,
  });

  return () => {
    observer.disconnect();
    renderSchedulerDeviceAware.flushIOCallback(); // 언마운트 시 플러시
  };
}, []);
```

### 성능 측정 및 티어 재평가

```typescript
// 첫 페이지 렌더링 성능 측정
if (pageNumber === 1) {
  const renderTime = t3 - t0; // ms
  renderSchedulerDeviceAware.measureInitialRenderPerformance(renderTime);
}
```

## 📊 API

### Getter 메서드

- `getConcurrency()`: 현재 동시 렌더 상한 (K)
- `getInFlight()`: 현재 실행 중인 작업 수
- `getQueueLength()`: 대기 중인 작업 수
- `getDeviceTier()`: 현재 기기 티어 ('low' | 'medium' | 'high')
- `getConfig()`: 티어별 설정 객체
- `getIODebounceMs()`: IO 디바운스 시간 (ms)
- `getViewportMarginVh()`: Viewport margin (vh 단위)

### 작업 관리 (기존 스케줄러와 동일)

- `enqueue(job)`: 렌더 작업 등록
- `bumpPriority(id, newPriority)`: 우선순위 변경
- `cancel(id)`: 작업 취소
- `setConcurrency(k)`: 동시성 수동 조정 (권장하지 않음)

### IO 디바운스 (신규)

- `debounceIOCallback(callback)`: 콜백을 디바운스하여 실행
- `flushIOCallback()`: 대기 중인 디바운스 콜백 즉시 실행

### 성능 측정 (신규)

- `measureInitialRenderPerformance(renderTimeMs)`: 초기 렌더 성능으로 티어 재평가

## 🧪 테스트 및 벤치마크

### 1. 테스트 페이지 실행

```bash
cd frontend
npm run dev

# 브라우저에서 접속
open http://localhost:3000/compare-device-aware
```

페이지에서 자동으로 기기를 감지하고 최적 설정을 적용합니다.

### 2. 벤치마크 실행

```bash
cd frontend

# 단일 테스트
node bench/real-user-pattern/bench-device-aware.js --cpu 4

# 전체 테스트 (고/중/저성능 기기 시뮬레이션)
./bench/real-user-pattern/run-device-aware.sh
```

### 3. 결과 확인

```bash
ls -lht bench/real-user-pattern/results/ | head -5
cat bench/real-user-pattern/results/device-aware-2024-10-17T12-30-00.json
```

## 📈 성능 특징

### 저성능 기기 최적화

- **IO 디바운스**: 200ms 디바운스로 스크롤/리사이즈 이벤트 횟수 대폭 감소
- **낮은 동시성**: K=1로 메인 스레드 부하 최소화
- **좁은 viewport**: 25vh로 불필요한 렌더링 방지

### 고성능 기기 최적화

- **높은 동시성**: K=5로 빠른 렌더링 (실사용자 테스트 기준 최적값)
- **넓은 viewport**: 50vh로 스크롤 전 미리 렌더링
- **짧은 디바운스**: 50ms로 반응성 유지

### 실시간 적응

- 첫 페이지 렌더링 시간을 측정하여 실제 성능 파악
- 브라우저 API 기반 티어와 실제 성능 티어 중 보수적으로 선택
- 런타임 중 티어 재평가로 최적 설정 자동 조정

## 🔍 디버깅

### 콘솔 로그 확인

```javascript
// 기기 감지 및 설정 적용
[Device-Aware Scheduler] 기기 성능 감지 완료
  - CPU 코어: 8개
  - 메모리: 16GB
  - 네트워크: 4g
  - 기기 타입: 데스크톱
  - 총점: 82.0/100
  - 티어: HIGH

[Device-Aware Scheduler] 티어별 설정 적용
  - 동시 렌더 상한 (K): 5
  - IO 디바운스: 50ms
  - Viewport Margin: 50vh
```

### 성능 측정

```javascript
[Device-Aware] PDF 렌더 완료 (p1) getPage: 12.3ms, render: 45.2ms, paint: 8.1ms, total: 65.6ms
[Device-Aware Scheduler] 티어 재평가: medium → high (실제 성능 기반)
```

## 💡 모범 사례

1. **디바운스 활용**: 모든 IO 이벤트 핸들러에 `debounceIOCallback()` 사용
2. **viewport margin 활용**: `getViewportMarginVh()`로 동적 설정
3. **성능 측정**: 첫 페이지에서 `measureInitialRenderPerformance()` 호출
4. **언마운트 시 플러시**: `flushIOCallback()`로 대기 중인 콜백 정리

## 🆚 기존 스케줄러와 비교

| 기능 | Basic | Adaptive | Device-Aware |
|------|-------|----------|--------------|
| 동시성 조정 | 수동 (K=5) | Long Task 기반 자동 | 기기 감지 기반 자동 |
| IO 디바운스 | ❌ | ❌ | ✅ (저성능 기기) |
| Viewport 최적화 | 고정 | 고정 | 티어별 동적 |
| 초기 성능 측정 | ❌ | ❌ | ✅ |
| 저성능 기기 대응 | 약함 | 중간 | 강함 |
| 고성능 기기 활용 | 중간 | 강함 | 강함 |

## 📚 참고

- 실사용자 테스트 결과: `bench/real-user-pattern/README.md`
- 벤치마크 스크립트: `bench/real-user-pattern/bench-device-aware.js`
- 테스트 페이지: `/compare-device-aware`
- PDF 컴포넌트: `components/resumeoverview_old/pdfDeviceAware/`

