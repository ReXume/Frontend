# 빠른 시작 가이드 - PDF vs 우선순위 큐 비교

## 5분 안에 시작하기 🚀

### 1단계: 개발 서버 실행

```bash
cd frontend
npm run dev
```

서버가 `http://localhost:3000`에서 실행되는지 확인하세요.

### 2단계: 벤치마크 실행

다른 터미널을 열어서 다음 중 하나를 실행하세요:

#### 옵션 A: npm scripts (가장 간단)

```bash
# 빠른 확인 (약 30초)
npm run bench:queue:fast

# 신뢰성 있는 측정 (약 5분) - 권장 ⭐
npm run bench:queue:realistic

# 강도 높은 테스트 (약 10분)
npm run bench:queue:intensive
```

#### 옵션 B: Shell 스크립트

```bash
# 기본 실행
./bench/bench-queue.sh

# 5회 측정, realistic 프리셋 (권장)
./bench/bench-queue.sh 5 realistic
```

#### 옵션 C: 직접 실행

```bash
# 기본
node bench/bench-queue-comparison.js

# 커스텀 설정
node bench/bench-queue-comparison.js \
  --runs 10 \
  --preset realistic \
  --id 4
```

### 3단계: 결과 확인

결과는 터미널에 표시되며, 다음과 같은 정보를 확인할 수 있습니다:

```
🏆 우선순위 큐의 장점 (개선율)
================================================================================

✅ 렌더링된 페이지 수
   PDF: 12
   Queue: 12
   개선: 0.00%

✅ PDF 평균 렌더링 시간
   PDF: 292.10ms
   Queue: 252.60ms
   개선: 13.52%

✅ Average FPS
   PDF: 52.30
   Queue: 58.70
   개선: 12.24%

...

📈 전체 평가:
   개선된 메트릭: 4/4
   평균 개선율: 31.96%
```

### 결과 파일

자세한 결과는 JSON 파일로 저장됩니다:

```
frontend/bench/bench_out/queue-comparison-[timestamp].json
```

## 프리셋 비교

| 프리셋 | 실행시간 | 대기시간 | CPU | 스크롤 | 용도 |
|--------|----------|----------|-----|--------|------|
| fast | ~30초 | 2초 | 1x | ❌ | 빠른 확인 |
| realistic | ~5분 | 7초 | 2x | ✅ | 신뢰성 있는 측정 ⭐ |
| intensive | ~10분 | 10초 | 4x | ✅ | 철저한 분석 |

## 다음 단계

더 자세한 정보는 [QUEUE_COMPARISON_README.md](./QUEUE_COMPARISON_README.md)를 참고하세요.

## 문제 해결

### "Cannot find module" 에러

```bash
cd frontend
npm install
```

### "Navigation timeout" 에러

개발 서버가 실행 중인지 확인하거나 대기 시간을 늘리세요:

```bash
node bench/bench-queue-comparison.js --wait 10000
```

### 브라우저가 열리지 않는 경우

Headless 모드를 비활성화해보세요:

```bash
node bench/bench-queue-comparison.js --headless false
```

