# PDF 첫페이지 렌더링 성능 벤치마크

PDF 첫페이지 렌더링 시간과 TBT(Total Blocking Time)를 측정하는 Puppeteer 기반 성능 벤치마크입니다.

## 목적

- PDF 첫페이지 렌더링 소요 시간 측정
- TBT (Total Blocking Time) 측정 및 분석
- 4x CPU 스로틀링 환경에서의 성능 비교
- 여러 PDF 렌더링 버전의 성능 차이 분석

## 측정 대상

다음 4개의 URL에 대해 성능을 측정합니다:

1. **Basic (개선 전)**: `http://localhost:3000/feedback-basic/4`
2. **Simple**: `http://localhost:3000/feedback/4?version=simple` - IntersectionObserver만 사용
3. **RAF**: `http://localhost:3000/feedback/4?version=raf` - requestAnimationFrame 사용
4. **RAF Windowing**: `http://localhost:3000/feedback/4?version=raf-windowing` - 점진적 마운트

## 사용법

### 1. 직접 실행
```bash
# 스크립트 직접 실행
node bench/pdf-firstpage-performance.js
```

### 2. npm 스크립트 사용
```bash
# package.json에 등록된 스크립트 사용
npm run bench:firstpage
```

### 3. 쉘 스크립트 사용
```bash
# 편리한 실행 스크립트
./bench/run-pdf-firstpage-benchmark.sh
```

## 설정

- **CPU 스로틀링**: 4x (저사양 환경 시뮬레이션)
- **반복 횟수**: 각 URL당 5회 측정
- **헤드리스 모드**: 활성화
- **타임아웃**: 2분

## 측정 지표

### 1. 첫페이지 렌더링 시간
- PDF 첫페이지가 완전히 렌더링되는데 소요되는 시간
- 캔버스 요소 렌더링 시간도 함께 측정

### 2. Total Blocking Time (TBT)
- FCP(First Contentful Paint) 이후 발생하는 LongTask들의 총 blocking 시간
- 50ms 이상의 LongTask만 계산에 포함

### 3. 기타 성능 지표
- First Paint (FP)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- LongTask 개수 및 평균 지속 시간
- Navigation Timing (DOMContentLoaded, LoadComplete)

## 결과 해석

### 성능 기준
- **TBT < 200ms**: ✅ Good
- **TBT 200-600ms**: ⚠️ Needs Improvement  
- **TBT > 600ms**: ❌ Poor

### 출력 예시
```
📊 측정 결과 (1회차): Basic (개선 전)
======================================================================
첫페이지 렌더링 시간: 1250.45ms ✅
First Paint: 850.32ms
First Contentful Paint: 1250.45ms
Largest Contentful Paint: 1350.67ms
Total Blocking Time: 180.45ms ✅
Long Tasks: 3개
LongTask 평균: 95.67ms, 최대: 125.43ms
DOM Content Loaded: 245.67ms
Load Complete: 1250.45ms
Canvas 요소 수: 2개
```

## 결과 저장

측정 결과는 `bench/results/` 디렉토리에 JSON 파일로 저장됩니다.

파일명 형식: `pdf-firstpage-performance-YYYY-MM-DDTHH-MM-SS-sssZ.json`

### 저장되는 데이터
- 각 URL별 측정 결과 (반복 횟수만큼)
- 통계 정보 (평균, 최소, 최대값)
- 설정 정보 (CPU 스로틀링, 반복 횟수 등)
- 타임스탬프 및 메타데이터

## 주의사항

1. **개발 서버 실행**: 측정 전에 `npm run dev`로 개발 서버가 실행되어야 합니다.
2. **CPU 스로틀링**: 4x 스로틀링으로 인해 측정 시간이 오래 걸릴 수 있습니다.
3. **네트워크**: 안정적인 네트워크 환경에서 실행하는 것을 권장합니다.
4. **시스템 리소스**: Puppeteer가 Chrome을 실행하므로 충분한 메모리가 필요합니다.

## 트러블슈팅

### PDF 첫페이지 렌더링 시간 측정 실패
- PDF 로딩이 완료되지 않았을 가능성
- 타임아웃을 늘리거나 개발 서버 상태 확인

### LongTask 측정 불가
- Performance Observer 지원 브라우저에서만 작동
- Chrome/Chromium 기반 환경에서 실행 권장

### 연결 오류
```bash
# 개발 서버 상태 확인
curl http://localhost:3000
```
