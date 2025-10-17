# 웹 바이탈 테스트

Google Core Web Vitals 지표를 측정하여 전반적인 웹 성능을 평가합니다.

## 빠른 실행

```bash
# 기본 실행 (3회, realistic 프리셋)
./run-test.sh

# 실행 횟수 지정 (5회)
./run-test.sh 5

# 프리셋 변경 (intensive)
./run-test.sh 5 intensive
```

## 비교 버전

- **Basic**: 기본 버전 (`/feedback-basic/4`)
- **PDF**: PDF 렌더링 버전 (`/feedback/4?version=pdf`)
- **Queue**: 우선순위 큐 버전 (`/feedback/4?version=queue`)

## 측정 지표

- FCP, LCP, CLS, INP, TTFB
- TTI (추정), TBT (계산)
- Long Tasks 분석

## 결과 확인

결과는 `./results/` 폴더에 저장됩니다.

자세한 내용은 [메인 README](../README.md)를 참조하세요.

