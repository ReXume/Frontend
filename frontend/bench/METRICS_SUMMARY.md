# 성능 지표 간단 요약

## 📅 타임라인 시각화

페이지 로드 시 지표들이 측정되는 순서:

```
0ms ─────────────────> [페이지 요청]
  │
  ├─ TTFB (50~100ms) ──> 서버가 첫 바이트 전송
  │
  ├─ FCP (100~200ms) ──> 첫 콘텐츠 표시
  │                       │
  │                       └─> [FCP ~ TTI 구간]
  │                           ├─ Long Task 1 (100ms) -> TBT +50ms
  │                           ├─ Long Task 2 (80ms)  -> TBT +30ms
  │                           └─ ...
  │
  ├─ LCP (400~600ms) ──> 가장 큰 콘텐츠 표시 (이미지, 텍스트 등)
  │
  ├─ TTI (400~1000ms) ──> 마지막 Long Task 종료 (상호작용 가능)
  │
  └─ Load Complete (500~1500ms) ──> 모든 리소스 로드 완료

CLS: 페이지 로드 전체 기간 동안 누적 측정
INP: 사용자 상호작용 시 측정 (클릭, 키보드 등)
```

## 🏆 Core Web Vitals (Google 공식 - web-vitals 라이브러리)

### FCP (First Contentful Paint)
- **측정:** 첫 텍스트/이미지 표시 시간
- **기준:** ✅ < 1.8s | ⚠️ 1.8s ~ 3.0s | ❌ > 3.0s
- **의미:** 사용자가 "페이지가 로드되기 시작했다"고 느끼는 시점

### LCP (Largest Contentful Paint)
- **측정:** 가장 큰 콘텐츠 표시 시간
- **기준:** ✅ < 2.5s | ⚠️ 2.5s ~ 4.0s | ❌ > 4.0s
- **의미:** 페이지의 주요 콘텐츠가 로드 완료된 시점

### CLS (Cumulative Layout Shift)
- **측정:** 예상치 못한 레이아웃 이동 점수
- **기준:** ✅ < 0.1 | ⚠️ 0.1 ~ 0.25 | ❌ > 0.25
- **의미:** 페이지 레이아웃 안정성 (0에 가까울수록 좋음)

### INP (Interaction to Next Paint)
- **측정:** 상호작용 응답 시간
- **기준:** ✅ < 200ms | ⚠️ 200ms ~ 500ms | ❌ > 500ms
- **의미:** 클릭/입력 후 화면 업데이트까지 걸리는 시간

### TTFB (Time to First Byte)
- **측정:** 서버 응답 시간
- **기준:** ✅ < 800ms | ⚠️ > 800ms
- **의미:** 서버가 첫 바이트를 보내는 속도

---

## ⚡ 추가 성능 지표

### TTI (Time to Interactive) - 추정
- **계산:** 마지막 Long Task 끝 시점
- **기준:** ✅ < 3.8s | ⚠️ 3.8s ~ 7.3s | ❌ > 7.3s
- **의미:** 페이지가 완전히 상호작용 가능해지는 시점

### TBT (Total Blocking Time) - 계산
- **계산:** FCP~TTI 구간 Long Tasks(>50ms) 합계
- **기준:** ✅ < 200ms | ⚠️ 200ms ~ 600ms | ❌ > 600ms
- **의미:** 메인 스레드가 블로킹된 총 시간

**계산 예시:**
```
FCP: 100ms, TTI: 600ms

Long Task 1: 100~200ms (duration: 100ms)
  -> Blocking: 100 - 50 = 50ms

Long Task 2: 300~430ms (duration: 130ms)
  -> Blocking: 130 - 50 = 80ms

Long Task 3: 700~800ms (duration: 100ms)
  -> 제외 (TTI 이후)

TBT = 50 + 80 = 130ms
```

### Long Tasks
- **측정:** 50ms 이상 걸린 JavaScript 작업 수
- **의미:** 메인 스레드를 블로킹하는 무거운 작업 개수

---

## 📜 스크롤 성능 (--scroll true)

### Average FPS
- **측정:** 스크롤 중 평균 프레임률
- **기준:** ✅ ≥ 50fps | ⚠️ 30~50fps | ❌ < 30fps

### Frame Drops
- **측정:** 30fps 이하 프레임 수
- **의미:** 버벅임으로 느껴지는 프레임 수

---

## 🎯 실전 활용

### 1. LCP가 느릴 때
**Attribution 확인:**
```
LCP: 3000ms ❌
  └─ Resource Load: 2000ms  <- 이미지 로딩이 느림
  └─ Render Delay: 500ms     <- 렌더링이 느림
```
**해결:**
- 이미지 최적화 (WebP, 압축)
- CDN 사용
- Lazy Loading

### 2. CLS가 높을 때
**Attribution 확인:**
```
CLS: 0.35 ❌
  └─ Largest Shift: 0.25 at 1500ms  <- 1.5초에 큰 시프트 발생
```
**해결:**
- 이미지/iframe 크기 미리 지정
- 폰트 최적화 (font-display: swap)
- 광고 영역 예약

### 3. TBT가 높을 때
**Long Tasks 확인:**
```
TBT: 800ms ❌
Long Tasks: 5개
```
**해결:**
- 무거운 JavaScript 분할
- Code Splitting
- Web Worker 사용
- requestIdleCallback 활용

### 4. INP가 높을 때
**Attribution 확인:**
```
INP: 450ms ⚠️
  └─ Processing: 380ms  <- 이벤트 처리가 느림
  └─ Input Delay: 40ms
  └─ Presentation: 30ms
```
**해결:**
- 이벤트 핸들러 최적화
- Debounce/Throttle 적용
- 무거운 계산을 Web Worker로 이동

---

## 🖥️ CPU Throttling (--cpu N)

저사양 디바이스 시뮬레이션:

| 설정 | 용도 | 효과 |
|------|------|------|
| `--cpu 1` | 제한 없음 (기본) | 고사양 PC |
| `--cpu 2` | 2배 느림 | 일반 모바일 |
| `--cpu 4` | 4배 느림 | 저사양 모바일 (권장) |
| `--cpu 6` | 6배 느림 | 매우 저사양 |

**CPU 4배 제한 시 변화:**
- LCP: 500ms → 1300ms (2.6배)
- TTI: 400ms → 2000ms (5배)
- TBT: 100ms → 800ms (8배)

---

## 📊 아이콘 범례

### 출처
- **🏆** = web-vitals 라이브러리 (Google 공식)
- **📊** = Performance API (폴백)
- **❌** = 측정 불가

### 성능 등급
- **✅** = Good (우수)
- **⚠️** = Needs Improvement (개선 필요)
- **❌** = Poor (심각)

---

## 🔗 상세 문서

더 자세한 내용은 [METRICS_CALCULATION.md](./METRICS_CALCULATION.md)를 참고하세요.

