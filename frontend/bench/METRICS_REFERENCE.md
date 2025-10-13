# 벤치마크 성능 지표 완전 가이드

## 📊 지표 분류 체계

### 🟢 Core Web Vitals (Google 공식)

**페이지 사용자 경험의 핵심 지표 - Google 검색 랭킹에 영향**

| 지표 | 설명 | 좋음 | 개선필요 | 나쁨 | 출처 |
|------|------|------|----------|------|------|
| **LCP** (Largest Contentful Paint) | 가장 큰 콘텐츠가 보이는 시간 | < 2.5s | 2.5-4s | > 4s | `webVitals.LCP` |
| **INP** (Interaction to Next Paint) | 상호작용 반응성 (FID 대체) | < 200ms | 200-500ms | > 500ms | `webVitals.INP` |
| **CLS** (Cumulative Layout Shift) | 레이아웃 시각적 안정성 | < 0.1 | 0.1-0.25 | > 0.25 | `webVitals.CLS` |

**Attribution (원인 분석)**:
- **LCP Attribution**: `element`, `url`, `resourceLoadDuration`, `elementRenderDelay`
- **INP Attribution**: `eventType`, `eventTarget`, `inputDelay`, `processingDuration`, `presentationDelay`
- **CLS Attribution**: `largestShiftTarget`, `largestShiftValue`, `largestShiftTime`

---

### 🔵 Other Web Vitals (Google 공식 보조지표)

**Core Web Vitals를 보완하는 로딩 성능 지표**

| 지표 | 설명 | 좋음 | 개선필요 | 출처 |
|------|------|------|----------|------|
| **FCP** (First Contentful Paint) | 첫 콘텐츠 표시 시간 | < 1.8s | > 1.8s | `webVitals.FCP` |
| **TTFB** (Time to First Byte) | 첫 바이트 도착 시간 | < 800ms | > 800ms | `webVitals.TTFB` |

**Attribution (원인 분석)**:
- **FCP Attribution**: `timeToFirstByte`, `firstByteToFCP`, `loadState`
- **TTFB Attribution**: `waitingDuration`, `cacheDuration`, `dnsDuration`, `connectionDuration`, `requestDuration`

---

### 🟡 Lighthouse 공식 지표 ⭐

**실험실 환경 성능 측정 - Lighthouse 직접 통합 (100% 정확)**

| 지표 | 설명 | 좋음 | 개선필요 | 나쁨 | 출처 |
|------|------|------|----------|------|------|
| **Performance Score** | 종합 성능 점수 | 90-100 | 50-89 | 0-49 | `lighthouse.performanceScore` |
| **TBT** (Total Blocking Time) | FCP~TTI 사이 메인스레드 차단 시간 | < 200ms | 200-600ms | > 600ms | `lighthouse.metrics.totalBlockingTime` |
| **TTI** (Time to Interactive) | 페이지가 완전히 상호작용 가능한 시간 | < 3.8s | 3.8-7.3s | > 7.3s | `lighthouse.metrics.interactive` |
| **Speed Index** | 콘텐츠가 시각적으로 표시되는 속도 | < 3.4s | 3.4-5.8s | > 5.8s | `lighthouse.metrics.speedIndex` |
| **FMP** (First Meaningful Paint) | 의미 있는 콘텐츠 표시 시간 | < 2s | 2-4s | > 4s | `lighthouse.metrics.firstMeaningfulPaint` |
| **Max Potential FID** | 최대 예상 First Input Delay | < 100ms | 100-300ms | > 300ms | `lighthouse.metrics.maxPotentialFID` |

**Lighthouse 진단 정보** (`lighthouse.diagnostics`):
- **mainThreadWorkBreakdown**: 메인 스레드 작업 분석 (Script Evaluation, Rendering, etc.)
- **bootupTime**: JavaScript 부팅 시간 분석
- **networkRequests**: 네트워크 요청 개수
- **totalByteWeight**: 전체 페이지 크기 (bytes)
- **domSize**: DOM 요소 개수

> 💡 **참고**: 이전 커스텀 계산값(`tti`, `tbtOfficial`)도 여전히 수집되며, Lighthouse 값과 비교 가능합니다.

---

### ⚪ Navigation/Loading 메트릭 (브라우저 표준)

**W3C Navigation Timing API 기반 - 모든 브라우저 지원**

| 지표 | 설명 | 출처 |
|------|------|------|
| **First Paint (FP)** | 첫 픽셀 렌더링 시간 | `firstPaint` |
| **DOM Interactive** | DOM 구문 분석 완료 시간 | `domInteractive` |
| **DOM Content Loaded** | DOMContentLoaded 이벤트 완료 시간 | `domContentLoaded` |
| **Load Complete** | 모든 리소스 로딩 완료 시간 | `loadTime` |

---

### 🔧 고급 성능 지표

#### 📦 **리소스 로딩 성능** (`resources`)
각 리소스 타입별 통계 (Resource Timing API):

| 타입 | 메트릭 | 설명 |
|------|--------|------|
| `script` | count, avgDuration, maxDuration, totalSize | JavaScript 파일 |
| `fetch` | count, avgDuration, maxDuration, totalSize | API 호출 |
| `stylesheet` | count, avgDuration, maxDuration, totalSize | CSS 파일 |
| `img` | count, avgDuration, maxDuration, totalSize | 이미지 |
| `link` | count, avgDuration, maxDuration, totalSize | 기타 링크 리소스 |
| `other` | count, avgDuration, maxDuration, totalSize | 기타 리소스 |

#### 💾 **메모리 사용량** (`memory`)
Chrome 전용 - Performance Memory API:

| 지표 | 설명 | 좋음 |
|------|------|------|
| `usedJSHeapSize` | 사용 중인 JS 힙 메모리 (bytes) | < 50MB |
| `totalJSHeapSize` | 전체 할당된 힙 메모리 (bytes) | - |
| `jsHeapSizeLimit` | 최대 힙 메모리 제한 (bytes) | - |
| `usedPercent` | 힙 사용률 (%) | < 50% |

#### 📐 **레이아웃 시프트 상세** (`layoutShifts`)
Layout Shift Entries 분석:

| 지표 | 설명 |
|------|------|
| `count` | 총 레이아웃 시프트 발생 횟수 |
| `totalScore` | 모든 시프트 점수 합계 |
| `maxShift` | 최대 단일 시프트 점수 |
| `avgShift` | 평균 시프트 점수 |

#### 🎬 **Long Animation Frames** (`longAnimationFrames`)
최신 브라우저 - LoAF API:

| 지표 | 설명 | 좋음 |
|------|------|------|
| `count` | 긴 애니메이션 프레임 횟수 | 적을수록 좋음 |
| `totalDuration` | 총 지속 시간 (ms) | - |
| `maxDuration` | 최대 프레임 시간 (ms) | < 50ms |
| `avgDuration` | 평균 프레임 시간 (ms) | < 16.67ms (60fps) |

#### 🚫 **렌더 블로킹 리소스** (`renderBlockingResources`)
초기 렌더링을 차단하는 리소스:

| 지표 | 설명 |
|------|------|
| `count` | 블로킹 리소스 개수 |
| `totalDuration` | 총 블로킹 시간 (ms) |

#### 💻 **디바이스/네트워크 정보**

| 지표 | 설명 | 출처 |
|------|------|------|
| `networkInfo.effectiveType` | 네트워크 타입 (4g, 3g, etc.) | Navigator.connection |
| `networkInfo.downlink` | 다운로드 속도 (Mbps) | Navigator.connection |
| `networkInfo.rtt` | 왕복 시간 (ms) | Navigator.connection |
| `deviceMemory` | 디바이스 메모리 (GB) | Navigator.deviceMemory |
| `hardwareConcurrency` | CPU 코어 수 | Navigator.hardwareConcurrency |

---

### 📜 **스크롤 성능 지표** (`scrollMetrics`)

**커스텀 - 실제 사용자 스크롤 시뮬레이션 측정**

| 지표 | 설명 | 좋음 | 개선필요 | 나쁨 |
|------|------|------|----------|------|
| `avgFps` | 평균 FPS | > 50 | 30-50 | < 30 |
| `minFps` | 최소 FPS | > 30 | - | < 30 |
| `frameDrops` | 프레임 드롭 횟수 (<30fps) | < 10 | 10-30 | > 30 |
| `scrollEvents` | 스크롤 이벤트 횟수 | - | - | - |
| `totalScrollTime` | 총 스크롤 시간 (ms) | - | - | - |
| `longTasksDuringScroll` | 스크롤 중 Long Tasks | 0 | - | > 0 |
| `renderEventsDuringScroll` | 스크롤 중 렌더링된 페이지 | - | - | - |

---

### 📄 **PDF 렌더링 성능** (`pdfRenderMetrics`)

**커스텀 - PDF.js 렌더링 세부 측정 (앱에서 보고)**

각 PDF 페이지마다 측정:

| 지표 | 설명 |
|------|------|
| `page` | 페이지 번호 |
| `getPageMs` | PDF.js getPage() 시간 (ms) |
| `renderMs` | 렌더링 준비 시간 (ms) |
| `paintMs` | Canvas 페인팅 시간 (ms) |
| `totalMs` | 총 렌더링 시간 (ms) |
| `timestamp` | 렌더링 시작 시점 |

**통계**:
- 평균/최대 렌더링 시간
- 가장 느린 페이지 식별
- 페이지별 성능 타임라인

---

### 🔍 **디버깅 정보**

#### **TBT Debug** (`tbtDebug`)
TBT 계산 과정 상세 정보:

| 지표 | 설명 |
|------|------|
| `method` | 계산 방식 (Lighthouse-compliant) |
| `fcp` | FCP 시점 (ms) |
| `tti` | TTI 시점 (ms) |
| `totalLongTasks` | 전체 Long Tasks 개수 |
| `tasksInFcpTtiRange` | FCP~TTI 구간 Long Tasks 개수 |
| `tbtCalculated` | 계산된 TBT 값 (ms) |
| `tasks[]` | 각 Long Task 상세 (start, end, duration, blocking) |

#### **Raw Values** (`raw`)
PerformanceObserver 원시 값:

| 지표 | 설명 |
|------|------|
| `raw.lcp` | LCP raw value (ms) |
| `raw.cls` | CLS raw value |
| `raw.inp` | INP raw value (ms) |

---

## 📋 지표 우선순위 (중요도순)

### 🔴 Critical (필수 개선)
1. **Core Web Vitals**: LCP, INP, CLS
2. **TBT**: 메인 스레드 차단 시간
3. **TTFB**: 서버 응답 속도

### 🟡 Important (권장 개선)
4. **FCP**: 첫 콘텐츠 표시
5. **TTI**: 상호작용 가능 시점
6. **Memory Usage**: 메모리 누수 확인
7. **Scroll Performance**: UX 체감 성능

### 🟢 Nice to Have (보조 참고)
8. **Resource Loading**: 리소스 최적화
9. **Long Animation Frames**: 부드러운 애니메이션
10. **Device/Network Info**: 환경별 분석

---

## 🎯 실전 사용 팁

### 1. **성능 개선 우선순위**
```
1. LCP > 2.5s? → 이미지 최적화, CDN, 코드 스플리팅
2. INP > 200ms? → JavaScript 최적화, 이벤트 핸들러 개선
3. CLS > 0.1? → 이미지/광고 크기 명시, 폰트 최적화
4. TBT > 200ms? → Long Task 분할, Web Worker 사용
5. Scroll FPS < 30? → 렌더링 최적화, lazy loading
```

### 2. **Attribution 활용**
```javascript
// LCP가 느린 경우
if (LCP > 2500) {
  // Attribution으로 원인 파악:
  // - element: 어떤 요소? (IMG, DIV?)
  // - resourceLoadDuration: 리소스 로딩이 느림?
  // - elementRenderDelay: 렌더링이 느림?
}

// INP가 느린 경우
if (INP > 200) {
  // Attribution으로 원인 파악:
  // - eventType: 어떤 이벤트? (click, keydown?)
  // - inputDelay: 입력 지연이 큼?
  // - processingDuration: 처리 시간이 김?
}
```

### 3. **벤치마크 비교**
```bash
# 두 버전 비교
node bench/compare.js \
  --baseline http://localhost:3000/feedback/4?version=old \
  --candidate http://localhost:3000/feedback/4?version=new
```

---

## 📚 참고 문서

- **Web Vitals**: https://web.dev/vitals/
- **Lighthouse**: https://developer.chrome.com/docs/lighthouse/
- **Navigation Timing**: https://www.w3.org/TR/navigation-timing-2/
- **Resource Timing**: https://www.w3.org/TR/resource-timing-2/
- **Performance API**: https://developer.mozilla.org/en-US/docs/Web/API/Performance

