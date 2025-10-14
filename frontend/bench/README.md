# 성능 벤치마크 시스템 🚀

## 📋 개요

이 벤치마크 시스템은 **Lighthouse**, **Web Vitals**, **PDF 렌더링 성능**, **커스텀 메트릭**을 통합하여 웹 페이지와 PDF 렌더링 성능을 종합적으로 측정합니다.

### ✨ 주요 기능

- 🏆 **Lighthouse 공식 지표**: TBT, TTI, Speed Index, Performance Score (100% 정확)
- 📊 **Core Web Vitals**: LCP, INP, CLS (Google 검색 랭킹 영향)
- 🔬 **Attribution 분석**: 각 지표의 상세 원인 분석
- 🔄 **PDF 렌더링 분석**: 중복 렌더, 동시성, Long Task 측정 (NEW!)
- 📄 **PDF 렌더링 성능**: PDF.js 페이지별 렌더링 시간
- 📜 **스크롤 성능**: FPS, 프레임 드롭, 스크롤 중 렌더링
- 🔍 **진단 정보**: 메인 스레드 작업, 리소스 로딩, 메모리 사용량

---

## 🚀 빠른 시작

### 설치

```bash
cd frontend
npm install
```

### 벤치마크 도구 선택

이 시스템은 4가지 벤치마크 도구를 제공합니다:

| 도구 | 특징 | 용도 | 속도 |
|------|------|------|------|
| **bench-queue-comparison.js** | PDF vs Queue 전용 비교 | 우선순위 큐 성능 검증 | ⚡⚡⚡ |
| **bench-webvitals.js** | Puppeteer + Web Vitals | 빠른 측정, 여러 버전 비교 | ⚡⚡⚡ |
| **bench-render.js** | PDF.js 렌더링 분석 | 렌더링 중복/동시성 측정 | ⚡⚡⚡ |
| **bench-lighthouse.js** | Lighthouse 전용 | 정확한 점수, 상세 진단 | ⚡⚡ |
| **bench.js** | 통합 (Web Vitals + Lighthouse) | 종합 분석, PDF 렌더링 | ⚡ |

### 🏆 우선순위 큐 성능 비교 (NEW! 추천)

PDF 버전과 우선순위 큐 버전을 직접 비교하여 개선율을 수치로 확인:

```bash
# npm scripts 사용 (권장)
npm run bench:queue                     # 기본 1회 실행
npm run bench:queue:fast               # 빠른 측정
npm run bench:queue:realistic          # 신뢰성 있는 측정 (5회) ⭐
npm run bench:queue:intensive          # 강도 높은 측정 (3회)

# Shell 스크립트 사용
./bench/bench-queue.sh                 # 기본 1회 실행
./bench/bench-queue.sh 5 realistic     # 5회, realistic 프리셋 ⭐

# 직접 실행
node bench/bench-queue-comparison.js --runs 5 --preset realistic
```

**측정 항목:**
- ✅ PDF 렌더링 성능 (렌더링 시간, 페이지 수)
- ✅ 스크롤 성능 (FPS, Frame Drops)
- ✅ 메모리 사용량 (JS Heap, DOM 노드)
- ✅ 인터랙션 반응 시간

📚 **[우선순위 큐 비교 가이드](./QUEUE_COMPARISON_README.md)** - 상세 사용법 및 해석

### 🎯 ReXume 3가지 버전 비교

프로젝트의 3가지 PDF 렌더링 방식을 한 번에 비교:

```bash
# 실제 환경 시뮬레이션 (권장) ⭐
npm run bench:compare:realistic

# 빠른 측정 (개발 중)
npm run bench:compare:fast

# 또는 기본 비교
npm run bench:compare
```

📚 **[3가지 버전 비교 상세 가이드](./COMPARE_GUIDE.md)**
📚 **[프리셋 가이드](./PRESET_GUIDE.md)** - realistic vs fast vs intensive

### 기본 사용법

#### 🎯 권장: Web Vitals 빠른 측정 (NEW!)

```bash
# npm scripts 사용 (권장)
npm run bench:webvitals -- --url "http://localhost:3000/feedback/4"

# 여러 버전 비교
npm run bench:webvitals -- \
  --url1 "http://localhost:3000/feedback/4?version=old" --name1 "Old" \
  --url2 "http://localhost:3000/feedback/4?version=new" --name2 "New" \
  --runs 3

# 직접 실행
node bench/bench-webvitals.js --url "http://localhost:3000/feedback/4"
```

📚 [Web Vitals 벤치마크 상세 가이드](./WEBVITALS_BENCH_README.md)

#### 🔄 PDF 렌더링 성능 분석 (NEW!)

```bash
# npm scripts 사용 (권장)
npm run bench:render -- --url "http://localhost:3000/feedback/4?version=queue"

# 2가지 버전 비교
npm run bench:render:compare

# 직접 실행 - 단일 URL
node bench/bench-render.js --url "http://localhost:3000/feedback/4?version=queue"

# 직접 실행 - 2가지 버전 비교
node bench/bench-render.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF Version" \
  --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue Version" \
  --runs 3
```

**측정 지표:**
- 🔄 최대 동시 렌더링 (동시에 렌더링되는 페이지 수)
- 📝 총 렌더 호출 (render() 메서드 호출 횟수)
- ⚠️ 중복 렌더 (동일 페이지 재렌더링 횟수)
- 🚫 취소된 렌더 (취소된 렌더링 작업 수)
- ⏱️ Long Task (50ms 이상 메인 스레드 블로킹)
- 🌐 중복 fetch (동일한 리소스 중복 요청)

#### 🏆 Lighthouse 공식 점수

```bash
npm run bench:lighthouse -- \
  --url1 "http://localhost:3000/feedback/4" \
  --runs 3
```

📚 [Lighthouse 벤치마크 상세 가이드](./LIGHTHOUSE_BENCH_README.md)

#### 🔬 종합 분석 (Web Vitals + Lighthouse + 커스텀)

```bash
# URL 모드 (웹 페이지 성능 측정)
npm run bench:full -- --url "http://localhost:3000/feedback/4" --wait 7000

# PDF 모드 (PDF 렌더링 성능 측정)
npm run bench:full -- --pdf "/public/sample4.pdf" --pages 12 --scale 1.5

# 두 버전 비교
node bench/compare.js \
  --baseline http://localhost:3000/feedback/4?version=old \
  --candidate http://localhost:3000/feedback/4?version=new \
  --runs 3
```

#### ⚡ 빠른 예제 실행

```bash
# 개발 서버가 실행 중인 상태에서
./bench/example-bench.sh
```

---

## 📊 출력 예시

### Lighthouse Performance Score
```
🎯 Lighthouse Performance Score: 85.0/100 ✅
```

### Core Web Vitals
```
📊 Core Web Vitals (web-vitals 공식 + Attribution):
  - LCP: 1200.5ms ✅
      Element: IMG, Resource Load: 800.0ms
      Render Delay: 50.0ms
  - INP: 180.0ms ✅
      Event: click on BUTTON
      Input Delay: 20.0ms, Processing: 140.0ms, Presentation: 20.0ms
  - CLS: 0.05 ✅
```

### Lighthouse 공식 지표
```
🔄 Interactivity & Performance:
  🏆 Lighthouse 공식 지표:
    - TTI (Lighthouse): 1500.0ms ✅
    - TBT (Lighthouse): 120.0ms ✅
    - Speed Index (Lighthouse): 2800.0ms ✅
    - FMP (Lighthouse): 1200.0ms
```

### PDF 렌더링 성능
```
📄 PDF Rendering Performance:
  Total pages rendered: 12
  Averages per page:
    - getPage: 45.2ms
    - render : 180.3ms
    - paint  : 120.5ms
    - total  : 346.0ms
  Slowest page: 5 (580.3ms)
```

### Lighthouse 진단
```
🔍 Lighthouse 진단:
  - 네트워크 요청: 25개
  - 전체 페이지 크기: 1.45MB
  - DOM 요소: 850개
  - 메인 스레드 작업 (Top 3):
    1. Script Evaluation: 1200ms
    2. Rendering: 450ms
    3. Painting: 280ms
```

---

## 📁 결과 파일

### 저장 위치
```
bench/bench_out/
├── results-2025-10-13T18-17-07-193Z.json  # 단일 측정 결과
└── compare-2025-10-13T18-17-07-330Z.json  # 비교 결과
```

### JSON 구조

```json
{
  "url": "http://localhost:3000/feedback/4",
  "totalTime": 71095,
  "lighthouse": {
    "performanceScore": 85,
    "metrics": {
      "totalBlockingTime": 120,
      "interactive": 1500,
      "speedIndex": 2800,
      "firstMeaningfulPaint": 1200
    },
    "diagnostics": { ... }
  },
  "metrics": {
    "webVitals": {
      "LCP": 1200,
      "INP": 180,
      "CLS": 0.05
    },
    "webVitalsAttribution": { ... },
    "pdfRenderMetrics": [ ... ],
    "scrollMetrics": { ... },
    "resources": { ... },
    "memory": { ... }
  }
}
```

---

## 🎯 성능 개선 가이드

### 1. Core Web Vitals 최적화

#### LCP > 2.5s
```bash
# Attribution으로 원인 파악
"webVitalsAttribution.LCP.resourceLoadDuration": 800  # 리소스 로딩 느림
"webVitalsAttribution.LCP.elementRenderDelay": 200    # 렌더링 지연

# 해결책
✓ 이미지 최적화 (WebP, AVIF)
✓ CDN 사용
✓ 코드 스플리팅
✓ Lazy Loading
```

#### INP > 200ms
```bash
# Attribution으로 원인 파악
"webVitalsAttribution.INP.processingDuration": 150  # 이벤트 처리 느림

# 해결책
✓ JavaScript 최적화
✓ Debounce/Throttle 적용
✓ Web Worker 사용
✓ requestIdleCallback 활용
```

#### CLS > 0.1
```bash
# Attribution으로 원인 파악
"webVitalsAttribution.CLS.largestShiftTarget": "IMG"  # 이미지 시프트

# 해결책
✓ 이미지/비디오 크기 명시
✓ 폰트 최적화 (font-display: swap)
✓ 광고/임베드 영역 예약
```

### 2. Lighthouse 점수 개선

#### Performance Score < 90
```bash
# Lighthouse 진단 활용
lighthouse.diagnostics.mainThreadWorkBreakdown  # 메인 스레드 병목 확인
lighthouse.diagnostics.bootupTime               # JS 부팅 시간 확인

# 해결책
✓ 사용하지 않는 JavaScript 제거
✓ Tree Shaking
✓ 이미지 최적화
✓ 텍스트 압축 (gzip, brotli)
```

#### TBT > 200ms
```bash
# Long Tasks 분석
tbtDebug.tasks  # 각 Long Task 상세 정보

# 해결책
✓ Long Task 분할 (50ms 이하)
✓ 무거운 계산을 Web Worker로 이동
✓ requestIdleCallback 사용
```

### 3. PDF 렌더링 최적화

```bash
# 느린 페이지 식별
pdfRenderMetrics[].totalMs > 500  # 500ms 이상 페이지

# 해결책
✓ 페이지별 lazy loading
✓ Canvas 크기 최적화
✓ Worker 사용 (pdf.worker.js)
✓ Render queue 관리
```

---

## 📚 참고 문서

### 지표 설명
- **[METRICS_SUMMARY.md](./METRICS_SUMMARY.md)** - 📊 **지표 계산 방식 간단 요약** (추천!)
- **[METRICS_CALCULATION.md](./METRICS_CALCULATION.md)** - 🔬 지표 계산 상세 설명
- [METRICS_REFERENCE.md](./METRICS_REFERENCE.md) - 모든 지표 상세 설명
- [METRICS_QUICK_REFERENCE.md](./METRICS_QUICK_REFERENCE.md) - 빠른 참조 가이드

### 벤치마크 가이드
- **[QUEUE_COMPARISON_README.md](./QUEUE_COMPARISON_README.md)** - 🏆 PDF vs Queue 비교 가이드 (NEW!)
- **[WEBVITALS_BENCH_README.md](./WEBVITALS_BENCH_README.md)** - Web Vitals 벤치마크 가이드
- **[RENDER_BENCH_README.md](./RENDER_BENCH_README.md)** - PDF 렌더링 성능 벤치마크 가이드
- **[COMPARE_GUIDE.md](./COMPARE_GUIDE.md)** - 3가지 버전 비교 가이드
- [LIGHTHOUSE_BENCH_README.md](./LIGHTHOUSE_BENCH_README.md) - Lighthouse 벤치마크 가이드

### 외부 문서
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://developer.chrome.com/docs/lighthouse/)
- [Core Web Vitals 가이드](https://web.dev/vitals/)

---

## 🔧 고급 사용법

### 커스텀 옵션

```bash
# 모든 옵션
node bench/bench.js \
  --url "http://localhost:3000/feedback/4" \
  --wait 7000 \                    # 안정화 대기 시간 (ms)
  --simulateInteraction true \     # 상호작용 시뮬레이션
  --port 3009                       # 서버 포트 (PDF 모드)
```

### 비교 옵션

```bash
# 여러 번 측정 (통계적 신뢰도)
node bench/compare.js \
  --baseline http://localhost:3000/old \
  --candidate http://localhost:3000/new \
  --runs 5 \                       # 5회 측정
  --wait 5000
```

---

## ⚙️ 기술 스택

### 벤치마크 엔진
- **Puppeteer** (24.24.1): Headless Chrome 제어
- **Lighthouse** (13.0.0): 공식 성능 측정 및 점수 산출
- **web-vitals** (4.2.4): Core Web Vitals + Attribution 분석

### 측정 방식
- **bench-webvitals.js**: Puppeteer + web-vitals (빠른 측정)
- **bench-lighthouse.js**: Lighthouse 단독 (정확한 점수)
- **bench.js**: Puppeteer + web-vitals + Lighthouse (종합 분석)

### 데이터 수집
- **Performance API**: 브라우저 네이티브 메트릭 (Navigation Timing, Resource Timing)
- **PerformanceObserver**: Long Tasks, Layout Shifts, Paint Timing
- **PDF.js**: PDF 렌더링 성능 측정

---

## 📝 주의사항

1. **Lighthouse 측정 시간**: 일반 측정보다 2-3배 더 소요됩니다 (정확도 향상)
2. **Node 버전**: Node 20.11+ 권장 (Lighthouse 13.0 요구사항)
3. **헤드리스 모드**: 실제 사용자 환경과 다를 수 있음
4. **네트워크 조건**: 로컬 측정 시 실제 환경과 차이 고려

---

## 🐛 문제 해결

### Lighthouse 실행 실패
```bash
# 에러: Lighthouse requires Node 22.19+
# 해결: 이전 버전으로 폴백 (커스텀 TBT/TTI 사용)
```

### 메모리 부족
```bash
# 에러: JavaScript heap out of memory
# 해결: Node 메모리 증가
NODE_OPTIONS="--max-old-space-size=4096" node bench/bench.js ...
```

### PDF 렌더링 타임아웃
```bash
# wait 시간 증가
node bench/bench.js --url "..." --wait 10000
```

