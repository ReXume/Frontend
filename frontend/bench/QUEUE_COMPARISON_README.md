# PDF vs 우선순위 큐 성능 비교 벤치마크

이 도구는 일반 PDF 렌더링 방식과 우선순위 큐를 사용한 렌더링 방식의 성능을 비교하여 우선순위 큐의 장점을 수치로 나타냅니다.

## 설치

```bash
npm install puppeteer
```

## 빠른 시작

### 1. 기본 비교 (1회 실행)

```bash
node bench/bench-queue-comparison.js
```

또는

```bash
chmod +x bench/bench-queue.sh
./bench/bench-queue.sh
```

### 2. 여러 번 실행하여 신뢰성 있는 통계 생성

```bash
# 10회 실행
node bench/bench-queue-comparison.js --runs 10
```

```bash
./bench/bench-queue.sh 10
```

### 3. 프리셋 사용

#### Fast 프리셋 (빠른 테스트)
- 대기 시간: 2초
- CPU 쓰로틀링: 없음
- 스크롤 테스트: 비활성화

```bash
node bench/bench-queue-comparison.js --preset fast
```

#### Realistic 프리셋 (권장)
- 대기 시간: 7초
- CPU 쓰로틀링: 2배 느림
- 스크롤 테스트: 활성화

```bash
node bench/bench-queue-comparison.js --preset realistic --runs 5
```

```bash
./bench/bench-queue.sh 5 realistic
```

#### Intensive 프리셋 (강도 높은 테스트)
- 대기 시간: 10초
- CPU 쓰로틀링: 4배 느림
- 스크롤 테스트: 활성화

```bash
node bench/bench-queue-comparison.js --preset intensive --runs 3
```

```bash
./bench/bench-queue.sh 3 intensive
```

## 커스텀 설정

### 개별 옵션 지정

```bash
node bench/bench-queue-comparison.js \
  --runs 5 \
  --wait 7000 \
  --cpu 2 \
  --scroll true \
  --headless true \
  --id 4
```

### 옵션 설명

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--runs` | 1 | 측정 반복 횟수 |
| `--wait` | 5000 | 페이지 로드 후 대기 시간 (ms) |
| `--cpu` | 2 | CPU 쓰로틀링 배수 (1=제한없음, 4=4배 느림) |
| `--scroll` | true | 스크롤 성능 테스트 활성화 |
| `--headless` | true | Headless 모드 실행 |
| `--id` | 4 | 피드백 ID |
| `--preset` | - | 프리셋 (fast, realistic, intensive) |

## 측정 메트릭

### 📄 PDF 렌더링 성능

**PDF.js 렌더링 파이프라인 단계별 측정**

**측정 지표:**
- **getPage**: PDF 페이지 객체 가져오기 시간 (ms)
- **render**: PDF 페이지 렌더링 시간 (ms)
- **paint**: Canvas에 그리기 시간 (ms)
- **total**: 전체 렌더링 시간 (ms)
- **renderOrder**: 페이지 렌더링 순서 (배열)
- **totalPagesRendered**: 렌더링된 총 페이지 수

> **참고**: 상세한 렌더링 시간(getPage, render, paint)을 측정하려면 애플리케이션 코드에서 `window.__pdfRenderMetrics` 배열에 메트릭을 푸시하거나 Performance API의 measure를 사용해야 합니다. 기본적으로는 렌더링된 캔버스 요소를 카운트합니다.

### 📜 스크롤 성능

**부드러운 스크롤 경험 측정**

- **Average FPS**: 평균 프레임율
  - 목표: 60 FPS
  - 좋음: > 55 FPS
  - 보통: 40~55 FPS
  - 나쁨: < 40 FPS

- **Min FPS**: 최소 프레임율
- **Frame Drops**: 30 FPS 이하로 떨어진 프레임 수
- **Total Scroll Time**: 전체 스크롤 시간

### 💾 메모리 사용량

**메모리 효율성 측정**

- **JS Heap Used**: JavaScript 힙 사용량
- **JS Heap Total**: JavaScript 힙 총량
- **DOM Nodes**: DOM 노드 수
- **Layout Count**: 레이아웃 재계산 횟수

### 🎯 인터랙션 성능

- **Avg Response Time**: 평균 반응 시간

## 출력 결과

### 콘솔 출력

```
================================================================================
📊 성능 비교 결과
================================================================================

📄 PDF 렌더링 성능
--------------------------------------------------------------------------------
메트릭                          PDF 버전                 우선순위 큐 버전
--------------------------------------------------------------------------------
getPage 평균 (ms)              45.3 ±5.2                42.1 ±4.8
render 평균 (ms)               234.5 ±23.4              198.7 ±18.9
paint 평균 (ms)                12.3 ±2.1                11.8 ±1.9
total 평균 (ms)                292.1 ±28.7              252.6 ±23.6

렌더링 순서:
  PDF 버전: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10...]
  Queue 버전: [1, 2, 3, 8, 9, 10, 4, 5, 6, 7...]

📜 스크롤 성능
--------------------------------------------------------------------------------
메트릭                          PDF 버전                 우선순위 큐 버전
--------------------------------------------------------------------------------
Average FPS                    52.3 ±3.4                58.7 ±2.1
Min FPS                        28.9 ±5.6                42.1 ±3.2
Frame Drops (< 30 FPS)         12.3 ±2.1                3.4 ±1.2
Total Scroll Time (ms)         5234.5 ±234.5            5156.7 ±198.7

💾 메모리 사용량
--------------------------------------------------------------------------------
메트릭                          PDF 버전                 우선순위 큐 버전
--------------------------------------------------------------------------------
JS Heap Used                   45.67 MB                 38.92 MB
JS Heap Total                  67.89 MB                 56.34 MB
DOM Nodes                      1234                     1156
Layout Count                   89                       67


================================================================================
🏆 우선순위 큐의 장점 (개선율)
================================================================================

✅ 렌더링된 페이지 수
   PDF: 12
   Queue: 12
   개선: 0.00%

✅ PDF 평균 렌더링 시간
   PDF: 292.10
   Queue: 252.60
   개선: 13.52%

✅ Average FPS
   PDF: 52.30
   Queue: 58.70
   개선: 12.24%

✅ Frame Drops
   PDF: 12.30
   Queue: 3.40
   개선: 72.36%

✅ JS Heap 메모리 사용량
   PDF: 47854592.00
   Queue: 40813568.00
   개선: 14.71%

--------------------------------------------------------------------------------
📈 전체 평가:
   개선된 메트릭: 4/4
   평균 개선율: 31.96%
--------------------------------------------------------------------------------

📁 결과 저장: /Users/.../bench_out/queue-comparison-2025-10-13T22-30-45-123Z.json

✅ 비교 완료!
```

### JSON 결과 파일

결과는 `bench_out/queue-comparison-[timestamp].json` 파일로 자동 저장됩니다.

```json
{
  "timestamp": "2025-10-13T22:30:45.123Z",
  "config": {
    "runs": 10,
    "waitTime": 7000,
    "cpuThrottle": 2,
    "scroll": true,
    "headless": true
  },
  "results": [
    {
      "name": "PDF 버전",
      "version": "pdf",
      "url": "http://localhost:3000/feedback/4?version=pdf",
      "runs": 10,
      "metrics": { ... },
      "pdfMetrics": { ... },
      "scrollMetrics": { ... },
      "interactionMetrics": { ... },
      "memoryMetrics": { ... }
    },
    {
      "name": "우선순위 큐 버전",
      "version": "queue",
      "url": "http://localhost:3000/feedback/4?version=queue",
      "runs": 10,
      "metrics": { ... },
      "pdfMetrics": { ... },
      "scrollMetrics": { ... },
      "interactionMetrics": { ... },
      "memoryMetrics": { ... }
    }
  ],
  "improvements": [
    {
      "metric": "렌더링된 페이지 수",
      "improvement": 0.00,
      "pdfValue": 12,
      "queueValue": 12
    },
    {
      "metric": "PDF 평균 렌더링 시간",
      "improvement": 13.52,
      "pdfValue": 292.10,
      "queueValue": 252.60
    },
    ...
  ],
  "summary": {
    "totalImprovements": 4,
    "avgImprovement": 31.96,
    "totalMetrics": 4
  }
}
```

## 권장 사용 시나리오

### 1. 빠른 확인 (개발 중)

```bash
node bench/bench-queue-comparison.js --preset fast
```

- 실행 시간: ~30초
- 용도: 코드 변경 후 빠른 성능 확인

### 2. 신뢰성 있는 측정 (PR 전)

```bash
node bench/bench-queue-comparison.js --preset realistic --runs 5
```

- 실행 시간: ~5분
- 용도: Pull Request 전 성능 검증

### 3. 철저한 분석 (릴리즈 전)

```bash
node bench/bench-queue-comparison.js --preset intensive --runs 10
```

- 실행 시간: ~15분
- 용도: 프로덕션 배포 전 최종 검증

## 해석 가이드

### 긍정적인 결과 (우선순위 큐가 우수)

- ✅ PDF 렌더링 시간 감소: 페이지가 더 빨리 렌더링됨
- ✅ Frame Drops 감소: 스크롤이 더 부드러움
- ✅ 메모리 사용량 감소: 더 효율적인 리소스 사용
- ✅ FPS 증가: 더 부드러운 애니메이션
- ✅ 렌더링된 페이지 수 증가: 더 많은 페이지가 표시됨

### 주의가 필요한 결과

- ❌ 개선율이 5% 미만: 통계적 오차 범위일 수 있음
- ❌ 일부 메트릭 악화: 특정 상황에서 최적화 필요
- ❌ 높은 표준편차: 측정 환경이 불안정하거나 더 많은 실행 필요

## 트러블슈팅

### 1. "Navigation timeout" 에러

```bash
# 대기 시간 증가
node bench/bench-queue-comparison.js --wait 10000
```

### 2. 메모리 부족

```bash
# Headless 모드 비활성화
node bench/bench-queue-comparison.js --headless false
```

### 3. 불안정한 결과

```bash
# 더 많은 실행으로 통계 안정화
node bench/bench-queue-comparison.js --runs 20
```

### 4. CPU 과부하

```bash
# CPU 쓰로틀링 감소
node bench/bench-queue-comparison.js --cpu 1
```

## 자동화

### CI/CD 통합

```yaml
# .github/workflows/performance.yml
name: Performance Test

on:
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run dev &
      - run: sleep 10
      - run: node bench/bench-queue-comparison.js --preset realistic --runs 3
      - uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: bench/bench_out/queue-comparison-*.json
```

### 주기적인 모니터링

```bash
# cron job 추가
0 2 * * * cd /path/to/project && node bench/bench-queue-comparison.js --preset realistic --runs 5
```

## 참고 자료

- [Web Vitals](https://web.dev/vitals/)
- [Puppeteer 문서](https://pptr.dev/)
- [PDF.js](https://mozilla.github.io/pdf.js/)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

## 라이선스

MIT

