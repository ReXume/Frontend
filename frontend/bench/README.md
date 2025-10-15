# 성능 벤치마크 시스템 🚀

## 📋 개요

웹 성능과 PDF 렌더링 성능을 측정하는 벤치마크 도구입니다.

---

## 🛠️ 벤치마크 도구

### 1. 웹바이탈 성능 측정 (bench-webvitals.js)

Core Web Vitals와 주요 성능 지표를 빠르게 측정합니다.

**측정 지표:**
- ✅ **FCP** (First Contentful Paint): 첫 콘텐츠 표시 시간
- ✅ **LCP** (Largest Contentful Paint): 최대 콘텐츠 표시 시간
- ✅ **CLS** (Cumulative Layout Shift): 누적 레이아웃 이동
- ✅ **INP** (Interaction to Next Paint): 상호작용 응답 시간
- ✅ **TTFB** (Time to First Byte): 첫 바이트까지의 시간
- ✅ **TTI** (Time to Interactive): 상호작용 가능 시간
- ✅ **TBT** (Total Blocking Time): 총 블로킹 시간

### 2. 시나리오 기반 PDF 성능 측정 (pdf-advanced-benchmark.js)

PDF 렌더링 방식(일반 vs 우선순위 큐)을 비교하여 성능 차이를 측정합니다.

**측정 지표:**
- 📄 렌더링 효율성 (pages/sec)
- ⏱️ Viewport 페이지 완료 시간
- 🎮 인터랙션 응답성
- 📉 프레임 드롭
- 📊 렌더링 순서
- 🔄 페이지당 렌더링 시간

---

## 🚀 사용법

### 설치

```bash
cd frontend
npm install
```

### 1. 웹바이탈 측정

#### 단일 URL 측정

```bash
# npm script 사용
npm run bench:webvitals -- --url "http://localhost:3000/feedback/4"

# 직접 실행
node bench/bench-webvitals.js --url "http://localhost:3000/feedback/4"
```

#### 여러 URL 비교

```bash
node bench/bench-webvitals.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF 버전" \
  --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "큐 버전" \
  --runs 3
```

#### 100번 반복 실행

```bash
# realistic 프리셋 (권장)
npm run bench:webvitals -- --url "http://localhost:3000/feedback/4" --preset realistic --runs 100

# 기본 설정
npm run bench:webvitals -- --url "http://localhost:3000/feedback/4" --runs 100
```

#### 주요 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--url` | 측정할 단일 URL | - |
| `--url1 ~ --url5` | 비교할 여러 URL (최대 5개) | - |
| `--name1 ~ --name5` | 각 URL의 이름 | Version 1~5 |
| `--runs` | 각 URL당 실행 횟수 | 1 |
| `--wait` | 페이지 로드 후 대기 시간 (ms) | 3000 |
| `--scroll` | 스크롤 시뮬레이션 활성화 | false |
| `--cpu` | CPU throttling (1=제한없음, 2=2배 느림) | 1 |
| `--preset` | 프리셋 (realistic, fast) | - |
| `--headless` | Headless 모드 | true |

#### 프리셋 설명

- **realistic**: 실제 환경 시뮬레이션 (wait=7s, cpu=2x, scroll)
- **fast**: 빠른 측정 (wait=2s, cpu=1x)

### 2. 시나리오 기반 PDF 성능 측정

```bash
# npm script 사용
npm run bench:scenario

# 직접 실행 (기본 10회)
node bench/pdf-advanced-benchmark.js

# 실행 횟수 지정
node bench/pdf-advanced-benchmark.js 20
```

---

## 📊 출력 예시

### 웹바이탈 측정 결과

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

⚡ Performance Timing:
  TTI (estimated): 2345.6ms ✅
  TBT (calculated): 145.8ms ✅
  Long Tasks: 3개

⏱️  Total: 8234ms
```

### 시나리오 측정 결과

```
🏆 PDF 성능 비교 (10회 평균)

📊 점진적 스크롤 (사용자가 천천히 읽기)
  PDF (일반):
    - 렌더링 효율: 2.3 pages/sec
    - Viewport 완료: 3450ms
    - 인터랙션 응답: 245ms
    
  Queue (우선순위 큐):
    - 렌더링 효율: 3.8 pages/sec (+65%)
    - Viewport 완료: 1890ms (-45%)
    - 인터랙션 응답: 156ms (-36%)
```

---

## 📁 결과 파일

모든 측정 결과는 `bench_out/` 디렉토리에 JSON 형식으로 저장됩니다.

```
bench/bench_out/
├── webvitals-2025-10-15T12-30-45-123Z.json
└── advanced-comparison-2025-10-15T12-45-30-456Z.json
```

---

## 🎯 성능 기준

### Core Web Vitals 기준

| 지표 | Good ✅ | Needs Improvement ⚠️ | Poor ❌ |
|------|---------|---------------------|---------|
| FCP | < 1.8s | 1.8s ~ 3.0s | > 3.0s |
| LCP | < 2.5s | 2.5s ~ 4.0s | > 4.0s |
| CLS | < 0.1 | 0.1 ~ 0.25 | > 0.25 |
| INP | < 200ms | 200ms ~ 500ms | > 500ms |
| TTFB | < 800ms | - | > 800ms |
| TTI | < 3.8s | 3.9s ~ 7.3s | > 7.3s |
| TBT | < 200ms | 200ms ~ 600ms | > 600ms |

---

## ⚙️ 기술 스택

- **Puppeteer** (24.24.1): Headless Chrome 제어
- **web-vitals** (4.2.4): Core Web Vitals + Attribution 분석
- **Performance API**: 브라우저 네이티브 메트릭

---

## 🐛 문제 해결

### Puppeteer 실행 오류

```bash
npm install puppeteer --force
```

### 측정값이 0 또는 N/A

- 대기 시간 증가: `--wait 5000`
- 스크롤 활성화: `--scroll true`
- Headless 끄기: `--headless false`

### 메모리 부족

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run bench:webvitals -- ...
```

---

## 💡 팁

1. **안정적인 측정**: 3회 이상 반복 실행 (`--runs 3`)
2. **실제 환경 시뮬레이션**: `--preset realistic` 사용
3. **네트워크 조건**: 같은 환경에서 측정
4. **백그라운드 프로세스**: 최소화하여 정확도 향상

---

## 📚 참고 자료

- [Web Vitals](https://web.dev/vitals/)
- [Core Web Vitals 가이드](https://web.dev/vitals/)
- [Puppeteer 문서](https://pptr.dev/)
