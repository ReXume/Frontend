# PDF 렌더링 성능 벤치마크 가이드 🔄

## 📋 개요

`bench-render.js`는 **PDF.js 렌더링 성능**을 심층 분석하는 벤치마크 도구입니다. PDF 페이지 렌더링의 중복 호출, 동시성, Long Task, fetch 중복 등을 측정하여 렌더링 최적화에 필요한 인사이트를 제공합니다.

### 🔧 작동 원리

이 벤치마크는 **Canvas API 패치**를 사용하여 PDF 렌더링을 추적합니다:
- `HTMLCanvasElement.prototype.getContext`를 패치하여 모든 Canvas 생성 감지
- 2D context의 `drawImage()` 호출을 모니터링
- ES module로 로드된 PDF.js도 자동으로 감지

**⚠️ 주의**: 개발 서버가 실행 중이어야 정확한 측정이 가능합니다!

### ✨ 주요 기능

- 🔄 **렌더링 동시성 측정**: 동시에 렌더링되는 페이지 수 추적
- 📝 **렌더 호출 추적**: PDF.js render() 메서드 호출 횟수
- ⚠️ **중복 렌더 감지**: 동일 페이지의 불필요한 재렌더링 파악
- 🚫 **취소 작업 추적**: 취소된 렌더링 작업 수 측정
- ⏱️ **Long Task 분석**: 50ms 이상 메인 스레드 블로킹 작업
- 🌐 **fetch 중복 감지**: 동일 리소스의 중복 요청 파악
- 📊 **버전 비교**: 여러 렌더링 방식 간 성능 비교

---

## 🚀 빠른 시작

### 기본 사용법

```bash
# npm scripts 사용 (권장)
npm run bench:render -- --url "http://localhost:3000/feedback/4?version=queue"

# 직접 실행
node bench/bench-render.js --url "http://localhost:3000/feedback/4?version=queue"
```

### 2가지 버전 비교

```bash
# 프로젝트의 2가지 PDF 렌더링 방식 비교 (권장)
npm run bench:render:compare

# 동일한 명령어 (전체)
node bench/bench-render.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF Version" \
  --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue Version" \
  --runs 3
```

---

## 📊 측정 지표

### 1. 최대 동시 렌더링 (maxConcurrency)

**의미**: 동시에 렌더링되는 PDF 페이지의 최대 개수

```
✅ 좋음: 1-2개 (순차적 렌더링)
⚠️ 주의: 3-5개 (중간 동시성)
❌ 나쁨: 6개 이상 (과도한 동시성)
```

**최적화 팁**:
- Queue 시스템으로 동시 렌더링 제한
- Viewport 내 페이지만 우선 렌더링
- IntersectionObserver로 lazy loading 구현

### 2. 총 렌더 호출 (totalRenderCalls)

**의미**: PDF.js의 `render()` 메서드가 호출된 총 횟수

```
✅ 좋음: 페이지 수와 동일 (예: 12페이지 → 12회)
⚠️ 주의: 페이지 수의 1.5배 이하
❌ 나쁨: 페이지 수의 2배 이상 (과도한 호출)
```

### 3. 중복 렌더 (duplicateRenderCount)

**의미**: 동일한 페이지+스케일 조합이 1초 이내에 재렌더링된 횟수

```
✅ 좋음: 0-2회 (거의 없음)
⚠️ 주의: 3-10회
❌ 나쁨: 10회 이상 (심각한 중복)
```

**원인**:
- React의 불필요한 리렌더링
- 스크롤 중 state 변경
- Canvas ref 재생성
- IntersectionObserver 중복 트리거

### 4. 취소된 렌더 (cancelledRenderCount)

**의미**: 시작된 렌더링 작업 중 취소된 횟수

```
✅ 좋음: 0-5회 (최소)
⚠️ 주의: 6-15회
❌ 나쁨: 15회 이상 (잦은 취소)
```

**해석**:
- 적절한 취소는 성능 최적화의 일부
- 과도한 취소는 비효율적인 렌더링 관리의 신호
- Queue 시스템 개선 필요

### 5. Long Task

**의미**: 50ms 이상 메인 스레드를 블로킹하는 작업

```
✅ 좋음: 0-5개, 총 500ms 이하
⚠️ 주의: 6-15개, 총 1000ms 이하
❌ 나쁨: 15개 이상, 총 1000ms 이상
```

**최적화 팁**:
- PDF Worker 활용
- requestIdleCallback으로 작업 분산
- Canvas 렌더링을 Web Worker로 이동

### 6. 중복 fetch (fetchDupCount)

**의미**: 동일한 리소스(PDF 파일)를 중복 요청한 횟수

```
✅ 좋음: 0회 (완벽한 캐싱)
⚠️ 주의: 1-3회
❌ 나쁨: 4회 이상 (캐싱 실패)
```

**원인**:
- HTTP 캐싱 미설정
- Range request 중복
- React의 Strict Mode 중복 렌더링

---

## 🎯 사용 예시

### 1. 단일 URL 측정

```bash
node bench/bench-render.js \
  --url "http://localhost:3000/feedback/4?version=queue"
```

**출력 예시**:
```
🎯 PDF 렌더링 성능 벤치마크
📊 측정 횟수: 1회
🔧 CPU 스로틀: 4x
📜 스크롤: 느림=120ms, 빠름=20ms

============================================================
📍 Single URL: http://localhost:3000/feedback/4?version=queue
============================================================
  ⏳ Run 1/1... ✅

📊 측정 결과:
  🔄 최대 동시 렌더링: 1.0 (min: 1, max: 1)
  📝 총 렌더 호출: 12.0 (min: 12, max: 12)
  ⚠️  중복 렌더: 0.0 (0.0%)
  🚫 취소된 렌더: 0.0 (0.0%)
  ⏱️  Long Task: 3.0개, 총 450ms
  🌐 중복 fetch: 0회

💾 결과 저장: bench/bench_out/render-2025-10-13T21-45-30-123Z.json
✨ 벤치마크 완료!
```

### 2. 여러 버전 비교 (3회 측정)

```bash
node bench/bench-render.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF Version" \
  --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue Version" \
  --runs 3
```

**출력 예시**:
```
============================================================
📊 버전 비교
============================================================

PDF Version vs Queue Version:
  ✅ 최대 동시 렌더링: 1.0 (-4.0, -80.0%)
  ✅ 총 렌더 호출: 12.0 (-18.0, -60.0%)
  ✅ 중복 렌더: 0.0 (-8.0, -100.0%)
  ✅ 취소된 렌더: 0.0 (-5.0, -100.0%)
  ✅ Long Task 개수: 3.0 (-2.0, -40.0%)
  ✅ Long Task 총 시간: 450ms (-300ms, -40.0%)
  ✅ 중복 fetch: 0 (-2, -100.0%)
```

### 3. 커스텀 설정

```bash
# CPU 스로틀링 조정 (더 강하게)
node bench/bench-render.js \
  --url "..." \
  --cpu 6

# 스크롤 속도 조정
node bench/bench-render.js \
  --url "..." \
  --scroll-slow 200 \
  --scroll-fast 10

# 결과 파일 저장 안 함
node bench/bench-render.js \
  --url "..." \
  --save false
```

---

## 📁 결과 파일

### 저장 위치

```
bench/bench_out/
└── render-2025-10-13T21-45-30-123Z.json
```

### JSON 구조

```json
{
  "timestamp": "2025-10-13T21:45:30.123Z",
  "config": {
    "runs": 3,
    "cpuThrottle": 4,
    "scrollSlowDelay": 120,
    "scrollFastDelay": 20
  },
  "results": [
    {
      "url": "http://localhost:3000/feedback/4?version=queue",
      "name": "Queue Version",
      "runs": [
        {
          "maxConcurrency": 1,
          "totalRenderCalls": 12,
          "duplicateRenderCount": 0,
          "cancelledRenderCount": 0,
          "longTaskCount": 3,
          "longTaskTotalMs": 450,
          "fetchDupCount": 0
        }
      ],
      "stats": {
        "maxConcurrency": { "min": 1, "max": 1, "avg": 1, "median": 1 },
        "totalRenderCalls": { "min": 12, "max": 12, "avg": 12, "median": 12 },
        ...
      }
    }
  ]
}
```

---

## 🔧 최적화 가이드

### 1. 중복 렌더링 제거

**문제**: `duplicateRenderCount`가 높음

**해결책**:
```javascript
// 1. React.memo로 컴포넌트 메모이제이션
const PDFPage = React.memo(({ pageNum, scale }) => {
  // ...
}, (prev, next) => 
  prev.pageNum === next.pageNum && 
  prev.scale === next.scale
);

// 2. useCallback으로 함수 메모이제이션
const renderPage = useCallback((pageNum) => {
  // ...
}, [scale]);

// 3. 렌더링 전 중복 체크
const renderCache = new Set();
const key = `${pageNum}@${scale}`;
if (renderCache.has(key)) return;
renderCache.add(key);
```

### 2. 동시성 제어

**문제**: `maxConcurrency`가 5개 이상

**해결책**:
```javascript
// Queue 시스템 구현
class RenderQueue {
  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
    this.queue = [];
  }

  async add(renderFn) {
    while (this.active >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    
    this.active++;
    try {
      return await renderFn();
    } finally {
      this.active--;
      const resolve = this.queue.shift();
      if (resolve) resolve();
    }
  }
}
```

### 3. Long Task 분산

**문제**: Long Task가 많고 총 시간이 김

**해결책**:
```javascript
// 1. requestIdleCallback 활용
function renderWhenIdle(pageNum) {
  requestIdleCallback((deadline) => {
    if (deadline.timeRemaining() > 16) {
      renderPage(pageNum);
    } else {
      renderWhenIdle(pageNum); // 다음 idle에 재시도
    }
  });
}

// 2. Web Worker 사용 (pdfjs worker)
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
```

### 4. fetch 중복 제거

**문제**: `fetchDupCount`가 높음

**해결책**:
```javascript
// 1. HTTP 캐싱 헤더 설정 (서버)
app.use('/pdfs', express.static('pdfs', {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// 2. 클라이언트 캐싱
const pdfCache = new Map();

async function loadPDF(url) {
  if (pdfCache.has(url)) {
    return pdfCache.get(url);
  }
  
  const pdf = await pdfjsLib.getDocument(url).promise;
  pdfCache.set(url, pdf);
  return pdf;
}
```

---

## ⚙️ 고급 옵션

### 모든 옵션

```bash
node bench/bench-render.js \
  --url "http://localhost:3000/feedback/4" \
  --runs 5 \                    # 측정 반복 횟수 (기본: 1)
  --cpu 4 \                     # CPU 스로틀링 배수 (기본: 4)
  --scroll-slow 120 \           # 느린 스크롤 딜레이 ms (기본: 120)
  --scroll-fast 20 \            # 빠른 스크롤 딜레이 ms (기본: 20)
  --save true                   # 결과 파일 저장 여부 (기본: true)
```

### 네트워크 조건

기본 설정 (고정):
- Latency: 40ms
- Download: 5Mbps
- Upload: 2Mbps

---

## 📊 성능 기준표

### 🏆 우수한 성능

```
✅ 최대 동시 렌더링: 1-2개
✅ 중복 렌더: 0-2회 (5% 이하)
✅ 취소된 렌더: 0-5회 (10% 이하)
✅ Long Task: 0-5개, 총 500ms 이하
✅ 중복 fetch: 0회
```

### ⚠️ 개선 필요

```
⚠️ 최대 동시 렌더링: 3-5개
⚠️ 중복 렌더: 3-10회 (5-20%)
⚠️ 취소된 렌더: 6-15회 (10-30%)
⚠️ Long Task: 6-15개, 총 500-1000ms
⚠️ 중복 fetch: 1-3회
```

### ❌ 심각한 문제

```
❌ 최대 동시 렌더링: 6개 이상
❌ 중복 렌더: 10회 이상 (20% 이상)
❌ 취소된 렌더: 15회 이상 (30% 이상)
❌ Long Task: 15개 이상, 총 1000ms 이상
❌ 중복 fetch: 4회 이상
```

---

## 🐛 문제 해결

### PDF.js 패치 실패

**증상**: `patch-timeout` 로그가 나타남

**원인**: PDF.js가 15초 내에 로드되지 않음

**해결**:
```bash
# 1. PDF.js worker 확인
ls public/pdf.worker.min.js

# 2. 빌드 후 worker 복사
npm run postbuild

# 3. 네트워크 조건 완화
# bench-render.js에서 타임아웃 증가
```

### 측정값 변동이 큼

**증상**: runs 간 편차가 큼

**해결**:
```bash
# 1. runs 증가
node bench/bench-render.js --url "..." --runs 10

# 2. CPU 스로틀링 강화
node bench/bench-render.js --url "..." --cpu 6

# 3. 백그라운드 프로세스 종료
# Chrome, IDE 등
```

### 메모리 부족

**증상**: Heap out of memory

**해결**:
```bash
# Node 메모리 증가
NODE_OPTIONS="--max-old-space-size=4096" \
  node bench/bench-render.js --url "..."
```

---

## 📚 참고 문서

- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [Long Tasks API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming)
- [메인 README](./README.md)
- [Web Vitals 벤치마크](./WEBVITALS_BENCH_README.md)

