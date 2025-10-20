# SendWithPromise 호출 추적 벤치마크

이 벤치마크 도구는 `SendWithPromise` 함수의 호출 시점과 성능을 추적하여 스크롤 이벤트와의 상관관계를 분석합니다.

## 주요 기능

- **SendWithPromise 호출 추적**: 함수 호출 시점, 지속 시간, 인자 개수 등 상세 정보 수집
- **스크롤 이벤트 연관성 분석**: 스크롤 이벤트와 SendWithPromise 호출의 상관관계 분석
- **3가지 버전 비교**: Base, PDF, Queue 버전 간 성능 차이 분석
- **병목 지점 식별**: 호출 패턴과 성능 병목 지점 식별

## 사용법

### 기본 실행 (3개 버전 비교)
```bash
./run-test.sh
```

### 단일 버전 테스트
```bash
./run-test.sh 1 base    # Base 버전만
./run-test.sh 1 pdf     # PDF 버전만  
./run-test.sh 1 queue   # Queue 버전만
```

### 다중 실행
```bash
./run-test.sh 3        # 3회 실행 (모든 버전)
./run-test.sh 5 pdf    # PDF 버전 5회 실행
```

### 직접 실행
```bash
# 단일 URL 테스트
node bench-sendwithpromise-analytics.js --url "http://localhost:3000/feedback/4"

# 3개 버전 비교
node bench-sendwithpromise-analytics.js \
  --url1 "http://localhost:3000/feedback-basic/4" --name1 "Base" \
  --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF" \
  --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue"
```

## 설정 옵션

- `--cpu`: CPU 스로틀링 배수 (기본값: 4)
- `--steps`: 스크롤 단계 수 (기본값: 8)
- `--delay`: 스크롤 단계 간 지연 시간 (기본값: 800ms)
- `--range`: 스크롤 범위 비율 (기본값: 0.3 = 30%)
- `--headless`: 헤드리스 모드 (기본값: true)

## 분석 결과

### 수집되는 데이터

1. **SendWithPromise 호출 정보**
   - 호출 시점 (timestamp)
   - 지속 시간 (duration)
   - 인자 개수
   - Promise 해결/거부 상태
   - 호출 스택 정보

2. **스크롤 이벤트 정보**
   - 스크롤 시점
   - 스크롤 위치 (scrollTop, scrollLeft)

3. **상관관계 분석**
   - 스크롤 이벤트 근처의 SendWithPromise 호출
   - 시간대별 호출 분포
   - 호출 패턴 분석

### 결과 파일

분석 결과는 `results/` 디렉토리에 JSON 형태로 저장됩니다:
- 파일명: `sendwithpromise-analysis-[timestamp].json`
- 형식: 타임스탬프, 설정 정보, 각 버전별 분석 결과

## 주요 분석 지표

- **총 호출 횟수**: SendWithPromise 함수의 총 호출 횟수
- **평균 호출 시간**: 호출 완료까지의 평균 시간
- **스크롤 연관성**: 스크롤 이벤트와 연관된 호출 비율
- **시간대별 분포**: 시간대별 호출 분포 패턴
- **Promise 성능**: Promise 해결/거부 시간 분석

## 문제 해결

### SendWithPromise가 감지되지 않는 경우

1. 함수가 후킹되지 않은 경우:
   - 브라우저 콘솔에서 `[SendWithPromise] 발견됨` 메시지 확인
   - 다른 위치에 함수가 있을 수 있음

2. 해당 버전에서 사용되지 않는 경우:
   - Base 버전에서는 PDF 관련 함수가 없을 수 있음
   - 버전별 차이점 확인 필요

### 성능 문제 해결

- CPU 스로틀링 조정 (`--cpu` 옵션)
- 스크롤 단계 수 줄이기 (`--steps` 옵션)
- 헤드리스 모드 사용 (`--headless true`)

## 예제 출력

```
🚀 SendWithPromise 호출 분석 벤치마크
================================
[SendWithPromise] 발견됨: window.pdfjsLib.SendWithPromise
[SendWithPromise] 호출 #1 @ 1234.56ms - 인자: 2개
[ScrollTrace] 스크롤 이벤트 @ 1500.23ms - Top: 100px

📊 SendWithPromise 호출 상세 분석: PDF
================================
⏱️ SendWithPromise 호출 통계:
   총 호출 횟수: 15개
   평균 지속시간: 12.34ms
   최대 지속시간: 45.67ms

🔗 스크롤 이벤트와 SendWithPromise 호출 상관관계:
   스크롤과 연관된 SendWithPromise 호출: 12/15개 (80.0%)
```

이 도구를 통해 SendWithPromise 함수의 호출 패턴과 스크롤 이벤트 간의 관계를 정확히 파악할 수 있습니다.
