# Puppeteer + Web Vitals 자동 측정 벤치마크

`bench-webvitals.js`는 Puppeteer와 web-vitals 라이브러리를 사용하여 웹 페이지의 Core Web Vitals를 자동으로 측정하는 벤치마크 도구입니다.

## 특징

- ✅ **Core Web Vitals 자동 측정**: FCP, LCP, CLS, INP, TTFB
- ✅ **Attribution 데이터**: 각 지표의 상세 정보 (병목 지점 분석)
- ✅ **여러 버전 비교**: 최대 5개 URL 동시 비교
- ✅ **반복 실행 & 통계**: 여러 번 실행하여 평균/최소/최대값 계산
- ✅ **스크롤 시뮬레이션**: 사용자 인터랙션 측정
- ✅ **자동 TTI/TBT 계산**: Long Tasks 기반 추정

## 설치

필요한 패키지가 이미 설치되어 있습니다:

```bash
npm install puppeteer web-vitals
```

## 사용법

### npm scripts 사용 (권장)

```bash
# 3가지 버전 비교 - realistic 프리셋 (권장) ⭐
npm run bench:compare:realistic

# 3가지 버전 비교 - 빠른 측정
npm run bench:compare:fast

# 단일 URL - 프리셋 사용
npm run bench:webvitals -- --url "..." --preset realistic
npm run bench:webvitals -- --url "..." --preset fast

# 기본 측정
npm run bench:webvitals -- --url "http://localhost:3000/feedback/4"
```

**프리셋 비교:**
- `realistic`: 실제 환경 시뮬레이션 (wait=7s, cpu=2x, scroll) - TBT 정확도 높음
- `fast`: 빠른 측정 (wait=2s, cpu=1x) - 개발 중 간단 확인

📚 **[프리셋 상세 가이드](./PRESET_GUIDE.md)**

### 직접 실행

### 1. 단일 URL 측정

```bash
node bench/bench-webvitals.js --url "http://localhost:3000/feedback/4"
```

### 2. 여러 URL 비교

```bash
node bench/bench-webvitals.js \
  --url1 "http://localhost:3000/feedback/4?version=old" --name1 "Old Version" \
  --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF Version" \
  --url3 "http://localhost:3000/feedback/4?version=new" --name3 "New Version"
```

### 3. 여러 번 실행 (통계)

```bash
node bench/bench-webvitals.js \
  --url "http://localhost:3000/feedback/4" \
  --runs 5
```

### 4. 스크롤 시뮬레이션 활성화

```bash
node bench/bench-webvitals.js \
  --url "http://localhost:3000/feedback/4" \
  --scroll true
```

### 5. CPU 제한 (저사양 디바이스 시뮬레이션)

```bash
# 4배 느린 CPU (모바일 저사양)
node bench/bench-webvitals.js \
  --url "http://localhost:3000/feedback/4" \
  --cpu 4

# 6배 느린 CPU (매우 저사양)
node bench/bench-webvitals.js \
  --url "http://localhost:3000/feedback/4" \
  --cpu 6
```

### 6. 대기 시간 조정

```bash
node bench/bench-webvitals.js \
  --url "http://localhost:3000/feedback/4" \
  --wait 5000
```

### 7. Headless 모드 비활성화 (브라우저 표시)

```bash
node bench/bench-webvitals.js \
  --url "http://localhost:3000/feedback/4" \
  --headless false
```

## 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--url` | 측정할 단일 URL | - |
| `--url1 ~ --url5` | 비교할 여러 URL (최대 5개) | - |
| `--name1 ~ --name5` | 각 URL의 이름 | Version 1~5 |
| `--runs` | 각 URL당 실행 횟수 | 1 |
| `--wait` | 페이지 로드 후 대기 시간 (ms) | 3000 |
| `--scroll` | 스크롤 시뮬레이션 활성화 | false |
| `--cpu` | CPU throttling (1=제한없음, 4=4배 느림, 6=6배 느림) | 1 |
| `--headless` | Headless 모드 활성화 | true |

## 측정 지표

### Core Web Vitals

- **FCP (First Contentful Paint)**: 첫 콘텐츠 표시 시간
  - ✅ Good: < 1.8s
  - ⚠️ Needs Improvement: 1.8s ~ 3.0s
  - ❌ Poor: > 3.0s

- **LCP (Largest Contentful Paint)**: 최대 콘텐츠 표시 시간
  - ✅ Good: < 2.5s
  - ⚠️ Needs Improvement: 2.5s ~ 4.0s
  - ❌ Poor: > 4.0s

- **CLS (Cumulative Layout Shift)**: 누적 레이아웃 이동
  - ✅ Good: < 0.1
  - ⚠️ Needs Improvement: 0.1 ~ 0.25
  - ❌ Poor: > 0.25

- **INP (Interaction to Next Paint)**: 상호작용 응답 시간
  - ✅ Good: < 200ms
  - ⚠️ Needs Improvement: 200ms ~ 500ms
  - ❌ Poor: > 500ms

- **TTFB (Time to First Byte)**: 첫 바이트까지의 시간
  - ✅ Good: < 800ms
  - ⚠️ Needs Improvement: > 800ms

### 추가 성능 지표

- **DOM Interactive**: DOM 파싱 완료 시간
- **DOM Content Loaded**: DOMContentLoaded 이벤트 시간
- **Load Complete**: 전체 로드 완료 시간
- **TTI (Time to Interactive)**: 상호작용 가능 시간 (추정)
- **TBT (Total Blocking Time)**: 총 블로킹 시간 (계산)
- **Long Tasks**: 긴 작업 수

### 스크롤 성능 (--scroll true)

- **Duration**: 스크롤 전체 시간
- **Avg FPS**: 평균 프레임률
- **Min FPS**: 최소 프레임률
- **Frame Drops**: 30fps 이하 프레임 수

## 출력 예시

```
📊 Web Vitals 측정 결과
======================================================================

🎯 Core Web Vitals:
  FCP: 1245.3ms ✅
      └─ TTFB: 234.5ms, TTFB→FCP: 1010.8ms
  LCP: 2134.7ms ✅
      └─ Element: IMG, Render Delay: 345.2ms
  CLS: 0.045 ✅
      └─ Max Shift: 0.023 at 1567.8ms
  INP: 156.4ms ✅
      └─ Event: click, Processing: 89.3ms
  TTFB: 234.5ms ✅
      └─ DNS: 12.3ms, Request: 145.2ms

⚡ Performance Timing:
  DOM Interactive: 1876.4ms
  DOM Content Loaded: 2012.3ms
  Load Complete: 3456.7ms
  TTI (estimated): 2345.6ms ✅
  TBT (calculated): 145.8ms ✅
  Long Tasks: 3개

⏱️  Total: 8234ms

✅ Good | ⚠️ Needs Improvement | ❌ Poor
```

## 결과 저장

모든 측정 결과는 `bench_out/webvitals-[timestamp].json` 파일에 자동 저장됩니다.

JSON 파일에는 다음 정보가 포함됩니다:

- 전체 설정 (runs, wait, scroll 등)
- 각 실행의 상세 결과
- Web Vitals 값 및 Attribution 데이터
- Performance Timing 정보
- 통계 (여러 번 실행시)

## 다른 벤치마크 도구와 비교

### bench-webvitals.js (이 도구)
- **장점**: 빠름, 간단함, Core Web Vitals 집중
- **용도**: 빠른 성능 측정, 여러 버전 비교

### bench-lighthouse.js
- **장점**: Lighthouse 공식 점수, 상세한 진단
- **용도**: 정확한 성능 점수, 상세 분석

### bench.js
- **장점**: 종합적 (Web Vitals + Lighthouse + 커스텀)
- **용도**: 전체적인 성능 분석, PDF 렌더링 측정

## 실전 예제

### 최적화 전후 비교

```bash
node bench/bench-webvitals.js \
  --url1 "http://localhost:3000/feedback/4" --name1 "Before" \
  --url2 "http://localhost:3000/feedback/4?optimized=true" --name2 "After" \
  --runs 3
```

### CI/CD 파이프라인 통합

```bash
# 성능 기준 검증
node bench/bench-webvitals.js \
  --url "https://production.example.com" \
  --runs 3 \
  > performance-report.txt

# JSON 결과 파싱하여 임계값 검증
# (별도 스크립트에서 처리)
```

### 로컬 개발 중 빠른 테스트

```bash
# 개발 서버 실행 후
node bench/bench-webvitals.js \
  --url "http://localhost:3000/feedback/4" \
  --headless false
```

## 문제 해결

### web-vitals 로드 실패

로컬 파일 로드 실패시 자동으로 CDN을 사용합니다. 다음과 같이 재설치할 수 있습니다:

```bash
npm install web-vitals@latest
```

### Puppeteer 실행 오류

Chrome/Chromium이 없는 경우:

```bash
npm install puppeteer --force
```

### 측정값이 0 또는 N/A

- 페이지 로드 대기 시간을 늘려보세요: `--wait 5000`
- 스크롤 시뮬레이션을 활성화하세요: `--scroll true`
- Headless 모드를 끄고 직접 확인하세요: `--headless false`

## 팁

1. **안정적인 측정을 위해 3회 이상 실행**: `--runs 3`
2. **네트워크 조건 고려**: 같은 네트워크 환경에서 테스트
3. **백그라운드 프로세스 최소화**: 시스템 리소스 확보
4. **측정 전 캐시 클리어**: 새로운 Puppeteer 인스턴스 사용으로 자동 처리됨

