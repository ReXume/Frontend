# 성능 지표 빠른 참조

## 🏷️ 지표 분류 한눈에 보기

### ✅ Web Vitals 공식 지표

#### Core Web Vitals (Google 검색 랭킹 영향)
- ✨ **LCP** - Largest Contentful Paint
- ⚡ **INP** - Interaction to Next Paint  
- 📐 **CLS** - Cumulative Layout Shift

#### Other Web Vitals
- 🎨 **FCP** - First Contentful Paint
- 🚀 **TTFB** - Time to First Byte

#### Lighthouse 공식 ⭐ (직접 통합)
- 🏆 **Performance Score** - 종합 성능 점수
- ⏱️ **TBT** - Total Blocking Time
- 🎯 **TTI** - Time to Interactive
- 📊 **Speed Index** - 시각적 진행 속도
- 🎨 **FMP** - First Meaningful Paint
- ⚡ **Max Potential FID**

---

### ❌ 비공식 지표 (보조/커스텀)

#### 브라우저 표준 API
- **First Paint (FP)** - Paint Timing API
- **DOM Interactive** - Navigation Timing API
- **DOM Content Loaded** - Navigation Timing API
- **Load Complete** - Navigation Timing API

#### 리소스 & 성능
- **Resource Timing** - 리소스별 로딩 통계
- **Memory Usage** - JS 힙 메모리 사용량
- **Layout Shifts (상세)** - 레이아웃 시프트 분석
- **Long Animation Frames** - 긴 프레임 감지
- **Render Blocking Resources** - 블로킹 리소스

#### 디바이스/환경
- **Network Info** - 네트워크 타입, 속도
- **Device Memory** - 디바이스 메모리
- **Hardware Concurrency** - CPU 코어

#### 커스텀 측정 (앱 전용)
- **Scroll Metrics** - 스크롤 FPS, 프레임 드롭
- **PDF Render Metrics** - PDF.js 렌더링 성능

---

## 📊 JSON 필드 매핑

### Web Vitals 공식
```json
{
  "webVitals": {
    "LCP": 1200,     // ✅ Core Web Vital
    "INP": 180,      // ✅ Core Web Vital
    "CLS": 0.05,     // ✅ Core Web Vital
    "FCP": 800,      // ✅ Other Web Vital
    "TTFB": 150      // ✅ Other Web Vital
  },
  "webVitalsAttribution": {
    "LCP": { ... },  // ✅ 원인 분석
    "INP": { ... },  // ✅ 원인 분석
    "CLS": { ... },  // ✅ 원인 분석
    "FCP": { ... },  // ✅ 원인 분석
    "TTFB": { ... }  // ✅ 원인 분석
  },
  "lighthouse": {
    "performanceScore": 85,  // ✅ 성능 점수 (0-100)
    "metrics": {
      "totalBlockingTime": 120,      // ✅ TBT (정확)
      "interactive": 1500,            // ✅ TTI (정확)
      "speedIndex": 2800,             // ✅ Speed Index (정확)
      "firstMeaningfulPaint": 1200,   // ✅ FMP
      "firstContentfulPaint": 800,    // ✅ FCP (Lighthouse)
      "largestContentfulPaint": 1200  // ✅ LCP (Lighthouse)
    },
    "diagnostics": {
      "mainThreadWorkBreakdown": [...],  // 메인 스레드 작업 분석
      "bootupTime": [...],               // JS 부팅 시간
      "networkRequests": 25,             // 네트워크 요청 수
      "totalByteWeight": 1500000,        // 전체 크기 (bytes)
      "domSize": 850                     // DOM 요소 수
    }
  }
}
```

### 비공식 지표
```json
{
  // ❌ 브라우저 표준 (W3C API)
  "firstPaint": 150,
  "firstContentfulPaint": 200,
  "domInteractive": 180,
  "domContentLoaded": 250,
  "loadTime": 1200,
  
  // ❌ 고급 성능 분석
  "resources": { ... },
  "memory": { ... },
  "layoutShifts": { ... },
  "longAnimationFrames": { ... },
  "renderBlockingResources": { ... },
  
  // ❌ 환경 정보
  "networkInfo": { ... },
  "deviceMemory": 8,
  "hardwareConcurrency": 8,
  
  // ❌ 커스텀 측정
  "scrollMetrics": { ... },
  "pdfRenderMetrics": [ ... ],
  
  // ❌ 디버깅
  "raw": { ... },
  "tbtDebug": { ... }
}
```

---

## 🎯 실무 활용

### Core Web Vitals 개선
```
LCP 개선: 이미지 최적화 → webVitalsAttribution.LCP.resourceLoadDuration 확인
INP 개선: JS 최적화 → webVitalsAttribution.INP.processingDuration 확인
CLS 개선: 레이아웃 안정화 → webVitalsAttribution.CLS.largestShiftTarget 확인
```

### 비공식 지표 활용
```
메모리 누수: memory.usedPercent > 75%
스크롤 버벅임: scrollMetrics.avgFps < 30
PDF 느림: pdfRenderMetrics[].totalMs > 500
리소스 병목: resources.fetch.maxDuration > 1000
```

---

## 📈 우선순위

### 1순위: Core Web Vitals (SEO/UX 직접 영향) ✅
- LCP, INP, CLS
- **Google 검색 랭킹 영향**

### 2순위: Lighthouse 성능 점수 (실험실 지표) ✅
- **Performance Score** (종합 점수)
- TBT, TTI, Speed Index
- **PageSpeed Insights와 동일한 점수**

### 3순위: Other Web Vitals (로딩 최적화) ✅
- FCP, TTFB
- **로딩 최적화 핵심**

### 4순위: Lighthouse 진단 정보 (병목 분석) ✅
- Main Thread Work Breakdown
- JavaScript Bootup Time
- **성능 문제 원인 파악**

### 5순위: 비공식 보조 지표 (디버깅/분석) ❌
- Resource Timing, Memory, Layout Shifts 등

### 6순위: 커스텀 지표 (앱 특화) ❌
- Scroll/PDF 성능 등

