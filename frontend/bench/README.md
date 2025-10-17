# PDF 렌더링 성능 벤치마크

PDF 렌더링 성능을 측정하고 비교하기 위한 벤치마크 도구 모음입니다.

## 📁 테스트 구조

```
bench/
├── web-vitals/           # 1. 웹 바이탈 테스트
├── rendering-scenarios/  # 2. 다양한 렌더링 상황 테스트
├── real-user-pattern/    # 3. 실사용자 패턴 테스트
└── README.md            # 이 파일
```

---

## 1️⃣ 웹 바이탈 테스트 (`web-vitals/`)

### 목적
Google의 Core Web Vitals 지표를 측정하여 전반적인 웹 성능을 평가합니다.

### 측정 지표
- **FCP** (First Contentful Paint): 첫 콘텐츠 렌더링 시간
- **LCP** (Largest Contentful Paint): 최대 콘텐츠 렌더링 시간
- **CLS** (Cumulative Layout Shift): 레이아웃 이동 점수
- **INP** (Interaction to Next Paint): 인터랙션 응답성
- **TTFB** (Time to First Byte): 첫 바이트까지의 시간
- **TTI** (Time to Interactive): 인터랙티브 가능 시간
- **TBT** (Total Blocking Time): 총 차단 시간

### 비교 버전
1. **Basic** - `http://localhost:3000/feedback-basic/4` (기본 버전)
2. **PDF** - `http://localhost:3000/feedback/4?version=pdf` (PDF 버전)
3. **Queue** - `http://localhost:3000/feedback/4?version=queue` (우선순위 큐 버전)

### 실행 방법

```bash
# 기본 실행 (3회, realistic 프리셋)
cd web-vitals
./run-test.sh

# 실행 횟수 지정 (5회)
./run-test.sh 5

# 프리셋 변경 (intensive: 저사양 환경 시뮬레이션)
./run-test.sh 5 intensive

# 직접 실행 (세부 옵션 조정)
node bench-webvitals.js \
  --url1 "http://localhost:3000/feedback-basic/4" --name1 "Basic" \
  --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF" \
  --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue" \
  --runs 3 \
  --preset realistic
```

### 프리셋 옵션
- **fast**: 빠른 측정 (2초 대기)
- **realistic**: 실제 환경 시뮬레이션 (7초 대기, 스크롤, CPU 2x)
- **intensive**: 저사양 환경 (10초 대기, 스크롤, CPU 4x)

### 결과 파일
- `./results/webvitals-[timestamp].json`

---

## 2️⃣ 렌더링 시나리오 테스트 (`rendering-scenarios/`)

### 목적
다양한 스크롤 속도 시나리오에서 렌더링 효율성을 비교합니다.

### 측정 시나리오
1. **점진적 스크롤** (2초 대기)
   - 일반적인 사용자 패턴
   - 천천히 문서를 읽는 상황
   
2. **빠른 스크롤** (500ms 대기)
   - 빠르게 훑어보는 패턴
   - 원하는 내용을 찾는 상황
   
3. **매우 빠른 스크롤** (200ms 대기)
   - 극한 상황 테스트
   - 우선순위 큐의 효과가 극대화되는 상황

### 측정 지표
- 렌더링 효율 (pages/sec)
- 렌더링된 페이지 수
- 페이지당 평균 렌더링 시간
- 프레임 드롭 수
- 초기 뷰포트 페이지 완료 시간 ⭐
- 인터랙션 응답 시간
- Long Tasks 수 & Total Blocking Time

### 비교 버전
1. **PDF** - `http://localhost:3000/feedback/4?version=pdf`
2. **Queue** - `http://localhost:3000/feedback/4?version=queue`

### 실행 방법

```bash
# 기본 실행 (5회)
cd rendering-scenarios
./run-test.sh

# 실행 횟수 지정 (10회)
./run-test.sh 10

# 직접 실행
node pdf-advanced-benchmark.js 5
```

### 결과 파일
- `./results/advanced-comparison-[timestamp].json`

---

## 3️⃣ 실사용자 패턴 테스트 (`real-user-pattern/`)

### 목적
실제 사용자의 문서 읽기 패턴을 시뮬레이션하여 성능을 측정합니다.

### 시뮬레이션 패턴
1. 빠르게 스크롤하여 내용 훑어보기
2. 관심 있는 부분에서 정지하여 읽기 (1.5초)
3. 이전 내용 확인을 위해 위로 스크롤하기
4. 반복

### 측정 지표
- 렌더 이벤트 수
- 렌더링 효율 (pages/sec)
- sendWithPromise 호출 수
- Long Tasks 발생 빈도
- Total Blocking Time
- 이벤트 타임라인 분석
- 상관관계 분석 (스크롤 → 렌더링 → LongTask)

### 비교 버전
1. **PDF** - `http://localhost:3000/feedback/4?version=pdf`
2. **Queue** - `http://localhost:3000/feedback/4?version=queue`

### 실행 방법

```bash
# 기본 실행 (3회, CPU 4x 고정)
cd real-user-pattern
./run-test.sh

# 실행 횟수 지정 (5회)
./run-test.sh 5

# CPU 스로틀링 비교 (4x vs 1x, 각 3회씩) ⭐
./run-compare-cpu.sh 3

# 직접 실행 (1회만)
node bench-pdfjs-longtasks.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
  --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue" \
  --cpu 4 \
  --realistic true
```

### CPU 스로틀링 비교

`run-compare-cpu.sh` 스크립트를 사용하면 저사양(4x)과 일반(1x) 환경을 동시에 테스트하고 4가지 버전을 한 번에 비교할 수 있습니다:
- **PDF-4x** vs **Queue-4x** (저사양 환경)
- **PDF-1x** vs **Queue-1x** (일반 환경)

### 결과 파일
- `./results/benchmark-results-[timestamp].json`

---

## 📊 결과 해석

### 1. 웹 바이탈 기준

| 지표 | Good ✅ | Needs Improvement ⚠️ | Poor ❌ |
|------|---------|----------------------|---------|
| FCP  | < 1.8s  | 1.8s ~ 3.0s          | > 3.0s  |
| LCP  | < 2.5s  | 2.5s ~ 4.0s          | > 4.0s  |
| CLS  | < 0.1   | 0.1 ~ 0.25           | > 0.25  |
| INP  | < 200ms | 200ms ~ 500ms        | > 500ms |
| TTFB | < 800ms | -                    | > 800ms |
| TTI  | < 3.8s  | 3.8s ~ 7.3s          | > 7.3s  |
| TBT  | < 200ms | 200ms ~ 600ms        | > 600ms |

### 2. 렌더링 효율

- **렌더링 효율** (pages/sec): 높을수록 좋음
- **프레임 드롭**: 적을수록 좋음
- **뷰포트 완료 시간**: 짧을수록 좋음 (⭐ 핵심 지표)

### 3. 응답성

- **Long Tasks**: 50ms 이상 걸리는 작업
- **Total Blocking Time**: Long Tasks의 50ms 초과 부분 합계
- 적을수록 사용자 인터랙션이 부드러움

---

## 🚀 빠른 시작

### 사전 준비

1. Next.js 개발 서버 실행
```bash
cd ../
npm run dev
```

2. 필수 패키지 설치
```bash
npm install puppeteer web-vitals
```

### 전체 테스트 한번에 실행 (권장)

```bash
# 기본 모드 (각 3회)
./run-all-tests.sh

# 빠른 테스트 (각 1회)
./run-all-tests.sh quick

# 전체 테스트 (각 5회)
./run-all-tests.sh full
```

### 개별 테스트 실행

```bash
# 1. 웹 바이탈 테스트
cd web-vitals
./run-test.sh 3 realistic

# 2. 렌더링 시나리오 테스트
cd ../rendering-scenarios
./run-test.sh 5

# 3. 실사용자 패턴 테스트
cd ../real-user-pattern
./run-test.sh 3
```

---

## 💡 팁

### 정확한 측정을 위한 권장사항

1. **백그라운드 프로세스 최소화**
   - 불필요한 애플리케이션 종료
   - 브라우저 탭 정리

2. **여러 번 실행하여 평균값 사용**
   - 최소 3회 이상 실행 권장
   - 이상치(outlier)는 제외

3. **동일한 환경에서 비교**
   - 같은 CPU throttle 설정
   - 같은 네트워크 환경
   - 같은 시간대 (서버 부하 고려)

4. **결과 파일 백업**
   - 각 테스트 결과는 타임스탬프와 함께 저장됨
   - 중요한 결과는 별도 백업 권장

---

## 📈 지속적인 성능 모니터링

### 자동화 예제

```bash
#!/bin/bash
# 매일 정해진 시간에 성능 테스트 실행 (cron 예제)

DATE=$(date +%Y-%m-%d)
LOG_DIR="./logs/${DATE}"
mkdir -p ${LOG_DIR}

# 웹 바이탈
cd web-vitals
./run-test.sh 3 realistic > ${LOG_DIR}/web-vitals.log 2>&1

# 렌더링 시나리오
cd ../rendering-scenarios
./run-test.sh 5 > ${LOG_DIR}/rendering.log 2>&1

# 실사용자 패턴
cd ../real-user-pattern
./run-test.sh 3 > ${LOG_DIR}/real-user.log 2>&1
```

---

## 🔧 문제 해결

### Puppeteer 관련

**문제**: Chromium 다운로드 실패
```bash
# 해결
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false npm install puppeteer
```

**문제**: "Cannot find module 'puppeteer'"
```bash
# 해결
npm install puppeteer
```

### 측정 관련

**문제**: 렌더 이벤트가 0개
- 원인: pdfRenderMetricsCollector가 제대로 작동하지 않음
- 해결: 페이지가 올바르게 로드되었는지 확인

**문제**: web-vitals 값이 모두 N/A
- 원인: web-vitals 라이브러리 로드 실패 또는 대기 시간 부족
- 해결: `--wait` 시간을 늘리거나 `--scroll true` 옵션 추가

---

## 📝 라이선스

이 벤치마크 도구는 프로젝트 내부에서 성능 측정 목적으로 사용됩니다.
