# LongTask 이벤트 분석 벤치마크

Lighthouse Performance 탭의 문제를 해결하고 LongTask의 정확한 발생 지점을 분석하기 위한 전용 벤치마크 도구입니다.

## 🎯 주요 기능

### 정확한 LongTask 추적
- **PerformanceObserver API** 활용한 실시간 LongTask 감지
- **스택 트레이스** 수집으로 LongTask 발생 원인 추적
- **이벤트 간 상관관계** 분석 (PDF 렌더링, 스크롤 이벤트 등)

### 이벤트 타임라인 분석
- LongTask 발생 시점과 지속시간 정확 측정
- PDF 렌더링 이벤트와 LongTask 연관성 분석
- 사용자 상호작용(스크롤, 클릭)과 LongTask 상관관계

### 상세한 메트릭 수집
- **Total Blocking Time (TBT)** 계산
- **LongTask 밀도** 분석 (시간대별 분포)
- **이벤트 발생 패턴** 시각화

## 📁 파일 구조

```
longtask-events/
├── bench-longtask-analytics.js  # 메인 벤치마크 스크립트
├── run-test.sh                  # 실행 스크립트
├── results/                     # 결과 저장 디렉토리
└── README.md                    # 이 파일
```

## 🚀 사용법

### 기본 실행 (PDF vs Queue 비교)
```bash
cd bench/longtask-events
./run-test.sh
```

### 여러 번 실행하여 통계 수집
```bash
# 3회 실행하여 평균값 계산
./run-test.sh 3

# PDF 버전만 5회 실행
./run-test.sh 5 pdf

# Queue 버전만 3회 실행
./run-test.sh 3 queue

# Base 버전만 3회 실행
./run-test.sh 3 base

# 3개 버전 모두 비교 (Base, PDF, Queue)
./run-test.sh 1 all
```

### 직접 스크립트 실행
```bash
# 단일 URL 분석
node bench/longtask-events/bench-longtask-analytics.js \
    --url "http://localhost:3000/feedback/4"

# 두 버전 비교 분석
node bench/longtask-events/bench-longtask-analytics.js \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
    --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue"

# 3개 버전 모두 비교 (Base vs PDF vs Queue)
node bench/longtask-events/bench-longtask-analytics.js \
    --url1 "http://localhost:3000/feedback-basic/4" --name1 "Base" \
    --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF" \
    --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue"
```

## ⚙️ 설정 옵션

### 명령행 옵션
- `--url`: 단일 URL 테스트
- `--url1`, `--url2`, `--url3`: 비교할 URL들 (최대 3개)
- `--name1`, `--name2`, `--name3`: 버전 이름 지정
- `--cpu N`: CPU 스로틀링 (기본: 4x)
- `--steps N`: 스크롤 단계 수 (기본: 15)
- `--delay N`: 스크롤 간 대기시간 ms (기본: 300)
- `--headless true/false`: 헤드리스 모드 (기본: true)
- `--output FILE`: 출력 파일 지정

### 예시
```bash
node bench/longtask-events/bench-longtask-analytics.js \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
    --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue" \
    --cpu 6 \
    --steps 20 \
    --delay 200 \
    --headless false
```

## 📊 분석 결과

### 콘솔 출력
벤치마크 실행 중 실시간으로 다음 정보가 출력됩니다:

1. **LongTask 상세 분석**
   - 총 LongTask 수 및 통계
   - 평균/최대 지속시간
   - Total Blocking Time 계산

2. **이벤트 상관관계 분석**
   - LongTask와 PDF 렌더링 이벤트 연관성
   - 시간대별 LongTask 발생 패턴
   - Top 10 가장 긴 LongTask 목록

3. **비교 분석** (두 버전 비교 시)
   - LongTask 수 비교
   - 이벤트 밀도 분석
   - 타임라인 비교

### JSON 결과 파일
`results/` 디렉토리에 타임스탬프가 포함된 JSON 파일이 저장됩니다:

```json
{
  "timestamp": "2025-01-XX...",
  "config": {
    "cpuThrottle": 4,
    "scrollSteps": 15,
    "stepDelay": 300,
    "headless": true
  },
  "results": [
    {
      "version": "PDF",
      "detectedVersion": "PDF Version",
      "url": "...",
      "duration": 45000,
      "analytics": {
        "longTasks": [...],
        "pdfEvents": [...],
        "userEvents": [...],
        "performanceEntries": [...]
      }
    }
  ]
}
```

## 🔍 결과 해석

### LongTask 분석 포인트

1. **발생 빈도**
   - LongTask 개수가 적을수록 좋음
   - 연속적인 LongTask 발생은 성능 문제 신호

2. **지속시간**
   - 50ms 이상이 LongTask로 분류
   - 100ms 이상은 심각한 성능 문제
   - 평균 지속시간이 짧을수록 좋음

3. **발생 시점**
   - 페이지 로드 초기: 초기화 과정의 문제
   - 스크롤 중: 렌더링 최적화 문제
   - PDF 렌더링과 연관: PDF.js 성능 문제

4. **Total Blocking Time**
   - 사용자 인터랙션 응답성 지표
   - 200ms 이하: 좋음 ✅
   - 200-600ms: 개선 필요 ⚠️
   - 600ms 이상: 나쁨 ❌

### PDF 렌더링과의 연관성

벤치마크는 다음을 분석합니다:

- **LongTask 발생 전후 PDF 이벤트**: 렌더링 중 LongTask 발생 여부
- **렌더링 시간 vs LongTask 지속시간**: 상관관계 분석
- **페이지별 성능 차이**: 특정 페이지에서 LongTask 집중 발생 여부

## 🛠️ 문제 해결

### LongTask가 감지되지 않는 경우
```bash
# CPU 스로틀링 증가
./run-test.sh --cpu 6

# 스크롤 강도 증가
node bench-longtask-analytics.js --steps 25 --delay 100
```

### 메모리 부족 오류
```bash
# Node.js 힙 메모리 증가
node --max-old-space-size=4096 bench-longtask-analytics.js [옵션]
```

### 페이지 로드 실패
- 개발 서버가 `http://localhost:3000`에서 실행 중인지 확인
- `npm run dev`로 서버 시작 후 재시도

## 📈 성능 개선 가이드

### 결과를 바탕으로 한 최적화 방향

1. **LongTask가 많이 발생하는 시점**
   - 해당 시점의 코드 분석 및 최적화
   - 큰 작업을 작은 청크로 분할
   - `setTimeout`이나 `requestIdleCallback` 활용

2. **PDF 렌더링과 관련된 LongTask**
   - PDF.js 렌더링 최적화
   - 캔버스 크기 조정
   - 렌더링 우선순위 큐 개선

3. **스크롤 중 LongTask**
   - 스크롤 이벤트 최적화
   - 가상화(virtualization) 구현
   - 스크롤 스로틀링/디바운싱

## 🔗 관련 도구

- [웹 바이탈 테스트](../web-vitals/): 전체적인 성능 지표 측정
- [실사용자 패턴 테스트](../real-user-pattern/): 실제 사용자 행동 시뮬레이션
- [렌더링 시나리오 테스트](../rendering-scenarios/): 다양한 렌더링 상황 테스트
