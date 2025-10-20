# PDF Simple 버전 가시적 테스트 가이드

이 가이드는 PDF Simple 버전을 headless가 아닌 브라우저에서 직접 보고 테스트하는 방법을 설명합니다.

## 사전 준비

### 1. 개발 서버 실행
```bash
cd frontend
npm run dev
```

서버가 `http://localhost:3000`에서 실행되는지 확인하세요.

### 2. 테스트할 페이지 확인
브라우저에서 다음 URL이 정상적으로 로드되는지 확인:
- `http://localhost:3000/feedback/4?version=simple` (Simple 버전)

## 테스트 실행 방법

### 방법 1: Simple 버전만 테스트 (가시적 모드)
```bash
cd frontend/bench/real-user-pattern
./run-simple-test-visible.sh [실행횟수] [CPU_THROTTLE]
```

예시:
```bash
# 기본 설정 (1회 실행, CPU 4x 스로틀링, 빠른 스크롤)
./run-simple-test-visible.sh

# 3회 실행, CPU 4x 스로틀링
./run-simple-test-visible.sh 3 4

# 1회 실행, CPU 6x 스로틀링 (더 느린 환경 시뮬레이션)
./run-simple-test-visible.sh 1 6
```

### 방법 2: 버전 비교 테스트 (가시적 모드)
```bash
cd frontend/bench/real-user-pattern
./run-comparison-visible.sh [실행횟수] [CPU_THROTTLE] [비교버전]
```

예시:
```bash
# Simple vs PDF 버전 비교 (CPU 4x, 빠른 스크롤)
./run-comparison-visible.sh 1 4 pdf

# Simple vs Queue 버전 비교 (CPU 4x, 빠른 스크롤)
./run-comparison-visible.sh 1 4 queue

# Simple vs PDF 버전 비교 (CPU 6x, 더 느린 환경)
./run-comparison-visible.sh 1 6 pdf
```

## 테스트 과정에서 확인할 점

### 1. 브라우저 창에서 직접 확인
- **페이지 로딩**: PDF가 어떻게 로드되는지 시각적으로 확인
- **스크롤 동작**: 실사용자 패턴 시뮬레이션 스크롤 동작 관찰
- **렌더링 과정**: 페이지가 언제 어떻게 렌더링되는지 확인
- **LongTask 발생**: 브라우저가 멈추는 순간들 관찰

### 2. 개발자 도구 활용
브라우저에서 F12를 눌러 개발자 도구를 열고:

#### Performance 탭
1. Recording 시작 (⚫ 버튼)
2. 테스트가 진행되는 동안 녹화
3. 테스트 완료 후 Stop
4. Timeline에서 다음을 확인:
   - **LongTask** (빨간색 막대)
   - **Rendering** 이벤트
   - **Painting** 이벤트
   - **Memory** 사용량

#### Console 탭
- PDF 렌더링 메트릭 로그 확인:
  ```
  Page X rendered successfully - getPage: X.XXms, render: X.XXms, paint: X.XXms, total: X.XXms
  ```

### 3. 측정되는 메트릭
- **getPageMs**: PDF.js에서 페이지 객체 가져오는 시간
- **renderMs**: Canvas에 그리기 시간  
- **paintMs**: 브라우저 페인팅 시간
- **totalMs**: 전체 렌더링 시간

## 결과 확인

### 1. 콘솔 출력
테스트 완료 후 터미널에서 결과 요약을 확인할 수 있습니다.

### 2. JSON 결과 파일
`./results/` 폴더에 생성되는 JSON 파일에서 상세한 측정 데이터를 확인할 수 있습니다.

### 3. 성능 분석
- LongTask 발생 빈도와 지속시간
- 메모리 사용 패턴
- 렌더링 지연 시간

## 문제 해결

### 브라우저가 열리지 않는 경우
```bash
# Puppeteer 재설치
cd frontend
npm install puppeteer@latest
```

### PDF가 로드되지 않는 경우
1. 개발 서버가 실행 중인지 확인
2. `http://localhost:3000/feedback/4?version=simple` 직접 접속 테스트
3. 네트워크 탭에서 PDF 파일 로딩 상태 확인

### 메트릭이 수집되지 않는 경우
- 브라우저 콘솔에서 에러 메시지 확인
- PDF.js 워커 초기화 상태 확인

## 참고사항

- 가시적 테스트는 CPU 성능에 영향을 줄 수 있으므로 정확한 측정을 위해서는 반복 테스트를 권장합니다
- 브라우저 창 크기와 화면 해상도가 테스트 결과에 영향을 줄 수 있습니다
- 다른 애플리케이션이 실행 중이면 정확한 측정이 어려울 수 있습니다
