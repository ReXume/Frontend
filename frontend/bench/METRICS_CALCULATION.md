# 성능 지표 계산 방식

이 문서는 `bench-webvitals.js`에서 측정하는 모든 지표의 계산 방식을 설명합니다.

## 🔄 측정 플로우

```
1. Puppeteer 브라우저 실행
   └─> CPU throttling 설정 (옵션)

2. 페이지 로드 전 설정 (evaluateOnNewDocument)
   ├─> Long Tasks Observer 시작
   ├─> web-vitals 초기화 함수 준비
   └─> 측정 결과 저장소 생성

3. 페이지 이동 (goto)
   └─> networkidle2, domcontentloaded 대기

4. web-vitals 라이브러리 주입
   ├─> 로컬 파일 시도
   └─> 실패 시 CDN 사용

5. 스크롤 시뮬레이션 (옵션)
   └─> FPS, Frame Drops 측정

6. 안정화 대기 (--wait)

7. 결과 수집 (evaluate)
   ├─> 🏆 web-vitals 공식 값
   ├─> 📊 Performance API 폴백
   ├─> TTI/TBT 계산
   └─> 출처 기록

8. 결과 출력 및 저장
```

## 📊 데이터 수집 방법

### 1. **데이터 출처**

지표는 2가지 출처에서 수집됩니다:

| 출처 | 아이콘 | 설명 |
|------|--------|------|
| **web-vitals 라이브러리** | 🏆 | Google 공식 라이브러리 (가장 정확) |
| **Performance API** | 📊 | 브라우저 네이티브 API (폴백) |

## 🏆 Core Web Vitals (Google 공식)

### 1. FCP (First Contentful Paint)
**측정 방법:** Google `web-vitals` 라이브러리 사용
```javascript
onFCP((metric) => {
  window.__metrics.webVitals.FCP = metric.value;
}, { reportAllChanges: true });
```

**의미:** 
- 페이지에서 첫 번째 텍스트나 이미지가 렌더링되는 시간
- 사용자가 "뭔가 보이기 시작했다"고 느끼는 순간

**Attribution (원인 분석):**
- `timeToFirstByte`: 서버 응답 시간
- `firstByteToFCP`: TTFB부터 FCP까지 소요 시간
- `loadState`: 페이지 로드 상태 (loading/dom-interactive/dom-content-loaded/complete)

**폴백 (web-vitals 실패 시):**
```javascript
// Performance API의 paint timing 사용
const fcpPaint = performance.getEntriesByType('paint')
  .find(e => e.name === 'first-contentful-paint');
performanceAPI.FCP = fcpPaint?.startTime;
```

---

### 2. LCP (Largest Contentful Paint)
**측정 방법:** Google `web-vitals` 라이브러리 사용
```javascript
onLCP((metric) => {
  window.__metrics.webVitals.LCP = metric.value;
}, { reportAllChanges: true });
```

**의미:**
- 뷰포트에서 가장 큰 콘텐츠 요소가 렌더링되는 시간
- 페이지의 주요 콘텐츠가 로드된 시점

**Attribution (원인 분석):**
- `element`: LCP 요소 태그명 (IMG, DIV 등)
- `url`: 리소스 URL (이미지인 경우)
- `timeToFirstByte`: TTFB
- `resourceLoadDelay`: 리소스 로드 지연 시간
- `resourceLoadDuration`: 리소스 로드 소요 시간
- `elementRenderDelay`: 요소 렌더링 지연 시간

**폴백 (web-vitals 실패 시):**
```javascript
// Performance API의 largest-contentful-paint 사용
const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
const lastEntry = lcpEntries[lcpEntries.length - 1];
performanceAPI.LCP = lastEntry.renderTime || lastEntry.loadTime;
```

---

### 3. CLS (Cumulative Layout Shift)
**측정 방법:** Google `web-vitals` 라이브러리 사용
```javascript
onCLS((metric) => {
  window.__metrics.webVitals.CLS = metric.value;
}, { reportAllChanges: true });
```

**의미:**
- 페이지 로드 중 발생하는 예상치 못한 레이아웃 이동의 누적 점수
- 0에 가까울수록 안정적

**Attribution (원인 분석):**
- `largestShiftValue`: 가장 큰 레이아웃 시프트 값
- `largestShiftTime`: 가장 큰 시프트가 발생한 시간
- `loadState`: 발생 시점의 로드 상태

**폴백 (web-vitals 실패 시):**
```javascript
// Performance API의 layout-shift entries 사용
const layoutShifts = performance.getEntriesByType('layout-shift');
let cls = 0;
layoutShifts.forEach(entry => {
  if (!entry.hadRecentInput) {  // 사용자 입력 직후는 제외
    cls += entry.value;
  }
});
performanceAPI.CLS = cls;
```

---

### 4. INP (Interaction to Next Paint)
**측정 방법:** Google `web-vitals` 라이브러리 사용
```javascript
onINP((metric) => {
  window.__metrics.webVitals.INP = metric.value;
}, { reportAllChanges: true });
```

**의미:**
- 사용자 상호작용(클릭, 탭, 키보드 입력)부터 다음 화면 업데이트까지 걸리는 시간
- 페이지 응답성을 측정

**Attribution (원인 분석):**
- `eventType`: 이벤트 타입 (click, keydown 등)
- `eventTarget`: 이벤트 대상 요소
- `inputDelay`: 입력 지연 시간
- `processingDuration`: 이벤트 처리 시간
- `presentationDelay`: 화면 갱신 지연 시간

**폴백 (web-vitals 실패 시):**
```javascript
// Performance API의 event entries 사용
const eventEntries = performance.getEntriesByType('event');
const durations = eventEntries
  .filter(e => e.duration >= 16)  // 16ms 이상만 (한 프레임)
  .map(e => e.duration);
performanceAPI.INP = Math.max(...durations);
```

---

### 5. TTFB (Time to First Byte)
**측정 방법:** Google `web-vitals` 라이브러리 사용
```javascript
onTTFB((metric) => {
  window.__metrics.webVitals.TTFB = metric.value;
});
```

**의미:**
- 브라우저가 서버로부터 첫 번째 바이트를 받는 시간
- 서버 응답 속도를 측정

**Attribution (원인 분석):**
- `waitingDuration`: 서버 대기 시간
- `cacheDuration`: 캐시 확인 시간
- `dnsDuration`: DNS 조회 시간
- `connectionDuration`: 연결 시간
- `requestDuration`: 요청 시간

**폴백 (web-vitals 실패 시):**
```javascript
// Navigation Timing API 사용
const nav = performance.getEntriesByType('navigation')[0];
performanceAPI.TTFB = nav.responseStart - nav.requestStart;
```

---

## ⚡ 커스텀 성능 지표

### 6. TTI (Time to Interactive) - 추정값
**계산 방법:** Long Tasks 기반 추정
```javascript
// 1. FCP 값 가져오기 (web-vitals 또는 Performance API)
const fcpTime = webVitals.FCP || timing.firstContentfulPaint;

// 2. FCP 이후의 Long Tasks 찾기
const tasksAfterFCP = longTasks.filter(t => t.startTime >= fcpTime);

// 3. 마지막 Long Task의 끝 시점이 TTI
if (tasksAfterFCP.length > 0) {
  const lastTask = tasksAfterFCP[tasksAfterFCP.length - 1];
  tti = lastTask.startTime + lastTask.duration;
} else {
  tti = fcpTime;  // Long Task 없으면 FCP가 TTI
}
```

**의미:**
- 페이지가 완전히 상호작용 가능한 시점
- 메인 스레드가 안정화되어 사용자 입력에 빠르게 응답할 수 있는 시점

**기준:**
- ✅ Good: < 3.8s
- ⚠️ Needs Improvement: 3.8s ~ 7.3s
- ❌ Poor: > 7.3s

---

### 7. TBT (Total Blocking Time) - 계산값
**계산 방법:** Lighthouse 방식 (FCP ~ TTI 구간의 Long Tasks)
```javascript
// 1. FCP ~ TTI 구간의 Long Tasks 필터링
const tasksInRange = longTasks.filter(task => {
  const taskEnd = task.startTime + task.duration;
  return taskEnd > fcpTime && task.startTime < tti;
});

// 2. 각 Long Task에서 50ms 초과 부분만 합산
const tbt = tasksInRange.reduce((sum, task) => {
  const blockingTime = Math.max(0, task.duration - 50);
  return sum + blockingTime;
}, 0);
```

**의미:**
- FCP부터 TTI까지 메인 스레드가 블로킹된 총 시간
- 50ms 이상 걸린 Long Tasks의 초과 시간 합계
- 사용자 입력 응답이 지연되는 정도

**Long Task란?**
- 50ms 이상 걸리는 JavaScript 실행
- 메인 스레드를 블로킹하여 페이지가 멈춘 것처럼 보임

**기준:**
- ✅ Good: < 200ms
- ⚠️ Needs Improvement: 200ms ~ 600ms
- ❌ Poor: > 600ms

---

## 📈 Navigation Timing 지표

Performance API의 Navigation Timing을 사용하여 측정:

```javascript
const nav = performance.getEntriesByType('navigation')[0];

timing.ttfb = nav.responseStart - nav.requestStart;
timing.domInteractive = nav.domInteractive - nav.fetchStart;
timing.domContentLoaded = nav.domContentLoadedEventEnd - nav.fetchStart;
timing.loadComplete = nav.loadEventEnd - nav.fetchStart;
```

### 8. DOM Interactive
**계산:** `domInteractive - fetchStart`
- DOM 파싱이 완료된 시점
- JavaScript가 DOM을 조작할 수 있는 시점

### 9. DOM Content Loaded
**계산:** `domContentLoadedEventEnd - fetchStart`
- DOMContentLoaded 이벤트 완료 시점
- 초기 HTML과 동기 스크립트 로드 완료

### 10. Load Complete
**계산:** `loadEventEnd - fetchStart`
- load 이벤트 완료 시점
- 모든 리소스(이미지, CSS, 폰트 등) 로드 완료

---

## 📜 스크롤 성능 지표

스크롤 시뮬레이션(`--scroll true`) 시 측정:

```javascript
// FPS 측정
const measureFPS = () => {
  const now = performance.now();
  const delta = now - lastFrameTime;
  const fps = 1000 / delta;
  
  scrollMetrics.fps.push(fps);
  if (fps < 30) {
    scrollMetrics.frameDrops++;  // 프레임 드롭 카운트
  }
  lastFrameTime = now;
};

// 스크롤 이벤트마다 측정
window.addEventListener('scroll', () => {
  requestAnimationFrame(measureFPS);
});
```

### 11. Average FPS
**계산:** `평균(모든 프레임의 FPS)`
- 스크롤 중 평균 프레임률
- 60fps가 이상적

### 12. Min FPS
**계산:** `최소(모든 프레임의 FPS)`
- 스크롤 중 최악의 프레임률

### 13. Frame Drops
**계산:** `30fps 이하 프레임 수`
- 사용자에게 버벅임으로 느껴지는 프레임

### 14. Scroll Duration
**계산:** `scrollEndTime - scrollStartTime`
- 전체 스크롤 시뮬레이션 소요 시간

---

## 🔍 Long Tasks 수집

Performance Observer를 사용하여 실시간 수집:

```javascript
const ltObserver = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    longTasks.push({
      startTime: entry.startTime,
      duration: entry.duration
    });
  }
});
ltObserver.observe({ type: 'longtask', buffered: true });
```

**Long Task 판정 기준:**
- 50ms 이상 실행되는 작업
- 메인 스레드를 블로킹하는 작업

---

## 🎯 출처 우선순위

각 지표는 다음 우선순위로 값을 결정:

1. **🏆 web-vitals 라이브러리** (최우선)
   - Google 공식 구현
   - Attribution 데이터 포함
   - 가장 정확함

2. **📊 Performance API** (폴백)
   - 브라우저 네이티브 API
   - web-vitals 실패 시 사용
   - 기본적인 측정값만 제공

3. **❌ 측정 불가**
   - 둘 다 실패한 경우
   - 예: INP는 상호작용이 없으면 측정 불가

```javascript
// 출처 기록
sources = {
  FCP: webVitals.FCP ? 'web-vitals' : (performanceAPI.FCP ? 'performance-api' : null),
  LCP: webVitals.LCP ? 'web-vitals' : (performanceAPI.LCP ? 'performance-api' : null),
  CLS: webVitals.CLS != null ? 'web-vitals' : (performanceAPI.CLS != null ? 'performance-api' : null),
  INP: webVitals.INP ? 'web-vitals' : (performanceAPI.INP ? 'performance-api' : null),
  TTFB: webVitals.TTFB ? 'web-vitals' : (performanceAPI.TTFB ? 'performance-api' : null)
};
```

---

## 🖥️ CPU Throttling

CPU 제한 시뮬레이션 (`--cpu N`):

```javascript
// Chrome DevTools Protocol (CDP) 사용
const client = await page.target().createCDPSession();
await client.send('Emulation.setCPUThrottlingRate', { 
  rate: cpuThrottle  // 1=제한없음, 4=4배느림, 6=6배느림
});
```

**효과:**
- JavaScript 실행 속도가 N배 느려짐
- Long Tasks가 길어지고 많아짐
- TTI, TBT가 크게 증가
- 저사양 디바이스 성능 시뮬레이션

---

## 📊 통계 계산

여러 번 실행 시 (`--runs N`) 통계 제공:

```javascript
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
const min = (arr) => Math.min(...arr);
const max = (arr) => Math.max(...arr);

statistics = {
  fcp: { avg: avg(fcps), min: min(fcps), max: max(fcps) },
  lcp: { avg: avg(lcps), min: min(lcps), max: max(lcps) },
  // ... 기타 지표
};
```

---

## 🎯 성능 기준

### Core Web Vitals 임계값

| 지표 | ✅ Good | ⚠️ Needs Improvement | ❌ Poor |
|------|---------|---------------------|---------|
| **FCP** | < 1.8s | 1.8s ~ 3.0s | > 3.0s |
| **LCP** | < 2.5s | 2.5s ~ 4.0s | > 4.0s |
| **CLS** | < 0.1 | 0.1 ~ 0.25 | > 0.25 |
| **INP** | < 200ms | 200ms ~ 500ms | > 500ms |
| **TTFB** | < 800ms | > 800ms | - |

### 기타 지표 임계값

| 지표 | ✅ Good | ⚠️ Needs Improvement | ❌ Poor |
|------|---------|---------------------|---------|
| **TTI** | < 3.8s | 3.8s ~ 7.3s | > 7.3s |
| **TBT** | < 200ms | 200ms ~ 600ms | > 600ms |
| **FPS** | ≥ 50 | 30 ~ 50 | < 30 |

---

## 💻 실제 구현 코드

### web-vitals 수집 전체 플로우

```javascript
// 1. 페이지 로드 전 설정
await page.evaluateOnNewDocument(() => {
  // 저장소 생성
  window.__metrics = {
    webVitals: {},     // web-vitals 공식 값
    attribution: {},   // Attribution 데이터
    longTasks: []      // Long Tasks 수집
  };

  // Long Tasks Observer
  const ltObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__metrics.longTasks.push({
        startTime: entry.startTime,
        duration: entry.duration
      });
    }
  });
  ltObserver.observe({ type: 'longtask', buffered: true });

  // web-vitals 초기화 함수
  const initWebVitals = () => {
    if (!window.webVitals) {
      setTimeout(initWebVitals, 100);
      return;
    }
    
    // FCP, LCP, CLS, INP, TTFB 구독
    window.webVitals.onLCP((metric) => {
      window.__metrics.webVitals.LCP = metric.value;
      window.__metrics.attribution.LCP = metric.attribution;
    }, { reportAllChanges: true });
    // ... 기타 지표
  };
  
  initWebVitals();
});

// 2. 페이지 이동
await page.goto(url);

// 3. web-vitals 주입
await page.addScriptTag({ 
  url: 'https://unpkg.com/web-vitals@4/dist/web-vitals.attribution.iife.js' 
});

// 4. 결과 수집
const results = await page.evaluate(() => {
  // TTI 계산
  const fcpTime = window.__metrics.webVitals.FCP;
  const tasksAfterFCP = window.__metrics.longTasks
    .filter(t => t.startTime >= fcpTime);
  const lastTask = tasksAfterFCP[tasksAfterFCP.length - 1];
  const tti = lastTask ? lastTask.startTime + lastTask.duration : fcpTime;
  
  // TBT 계산
  const tasksInRange = window.__metrics.longTasks.filter(task => {
    const taskEnd = task.startTime + task.duration;
    return taskEnd > fcpTime && task.startTime < tti;
  });
  const tbt = tasksInRange.reduce((sum, task) => {
    return sum + Math.max(0, task.duration - 50);
  }, 0);
  
  return window.__metrics;
});
```

---

## 🔗 참고 자료

- [Web Vitals](https://web.dev/vitals/)
- [web-vitals 라이브러리](https://github.com/GoogleChrome/web-vitals)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API)
- [Lighthouse Metrics](https://developer.chrome.com/docs/lighthouse/performance/)
- [Long Tasks API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming)

