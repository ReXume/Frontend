# ReXume 3가지 버전 성능 비교 가이드

## 📋 비교 대상 버전

이 프로젝트는 3가지 PDF 렌더링 방식을 제공합니다:

| 버전 | URL | 설명 |
|------|-----|------|
| **PDF Version** | `/feedback/4?version=pdf` | PDF.js 직접 렌더링 |
| **Basic Version** | `/feedback-basic/4` | 기본 PDF 뷰어 |
| **Queue Version** | `/feedback/4?version=queue` | 렌더 큐 방식 |

## 🚀 빠른 시작

### 1. npm 명령어 사용 (가장 간단!)

```bash
# 개발 서버 실행 (별도 터미널)
npm run dev

# 실제 환경 시뮬레이션 (권장) ⭐
npm run bench:compare:realistic

# 빠른 측정 (개발 중)
npm run bench:compare:fast

# 기본 비교 (3회씩 측정, 스크롤 포함)
npm run bench:compare
```

**프리셋별 특징:**
- `realistic`: 실제 사용자 환경 (TBT 정확도 높음)
- `fast`: 빠른 측정 (개발 중 간단 확인)

### 2. 스크립트 직접 실행

```bash
# 기본 (3회 실행)
./bench/bench-compare-versions.sh

# 측정 횟수 지정 (5회 실행)
./bench/bench-compare-versions.sh 5
```

### 3. 세부 옵션 조정

```bash
node bench/bench-webvitals.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF Version" \
  --url2 "http://localhost:3000/feedback-basic/4" --name2 "Basic Version" \
  --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue Version" \
  --runs 5 \
  --scroll true \
  --wait 5000
```

## 📊 측정 지표

### Core Web Vitals
- **LCP (Largest Contentful Paint)**: 최대 콘텐츠 표시 시간
  - ✅ Good: < 2.5s
  - ⚠️ Needs Improvement: 2.5s ~ 4.0s
  - ❌ Poor: > 4.0s

- **CLS (Cumulative Layout Shift)**: 레이아웃 안정성
  - ✅ Good: < 0.1
  - ⚠️ Needs Improvement: 0.1 ~ 0.25
  - ❌ Poor: > 0.25

- **INP (Interaction to Next Paint)**: 상호작용 응답성
  - ✅ Good: < 200ms
  - ⚠️ Needs Improvement: 200ms ~ 500ms
  - ❌ Poor: > 500ms

### 성능 지표
- **TTI (Time to Interactive)**: 상호작용 가능 시점
- **TBT (Total Blocking Time)**: 총 블로킹 시간
- **FPS (Frames Per Second)**: 스크롤 성능

## 📈 결과 예시

```
🏆 버전 비교
======================================================================

【PDF Version】
  FCP: 1234.5ms
  LCP: 2456.7ms ✅
  CLS: 0.023 ✅
  TTI: 3456.8ms ✅
  TBT: 234.5ms ⚠️

【Basic Version】
  FCP: 987.3ms
  LCP: 1876.2ms ✅
  CLS: 0.045 ✅
  TTI: 2345.6ms ✅
  TBT: 123.4ms ✅

【Queue Version】
  FCP: 1123.4ms
  LCP: 2234.5ms ✅
  CLS: 0.012 ✅
  TTI: 3123.4ms ✅
  TBT: 189.2ms ✅
```

## 💡 성능 분석 팁

### 1. LCP 비교
LCP가 가장 낮은 버전이 초기 로딩이 빠릅니다.
- Attribution에서 `resourceLoadDuration`과 `elementRenderDelay` 확인
- 이미지/PDF 로딩 최적화가 필요한지 판단

### 2. CLS 비교
CLS가 가장 낮은 버전이 레이아웃이 안정적입니다.
- PDF 렌더링 중 레이아웃 시프트 확인
- 컨테이너 크기를 미리 지정했는지 확인

### 3. INP/TTI 비교
INP와 TTI가 낮은 버전이 사용자 상호작용에 빠르게 반응합니다.
- 렌더 큐 방식이 메인 스레드 블로킹을 줄이는지 확인
- Long Tasks 수 비교

### 4. 스크롤 성능 비교
FPS가 높고 Frame Drops가 적은 버전이 스크롤이 부드럽습니다.
- PDF lazy loading이 잘 작동하는지 확인
- IntersectionObserver 설정 최적화

## 📁 결과 파일

모든 측정 결과는 `bench/bench_out/webvitals-[timestamp].json`에 저장됩니다.

### JSON 구조
```json
{
  "timestamp": "2025-10-13T...",
  "config": {
    "runs": 3,
    "waitTime": 3000,
    "enableScroll": true
  },
  "results": {
    "PDF Version": [...],
    "Basic Version": [...],
    "Queue Version": [...]
  },
  "statistics": {
    "PDF Version": {
      "lcp": { "avg": 2456.7, "min": 2401.2, "max": 2523.4 },
      "cls": { "avg": 0.023, "min": 0.021, "max": 0.025 },
      ...
    },
    ...
  }
}
```

## 🔧 고급 옵션

### 측정 횟수 늘리기 (더 정확한 통계)
```bash
npm run bench:compare -- --runs 10
```

### CPU 제한 (저사양 디바이스 시뮬레이션)
```bash
# 4배 느린 CPU로 3가지 버전 비교
node bench/bench-webvitals.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
  --url2 "http://localhost:3000/feedback-basic/4" --name2 "Basic" \
  --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue" \
  --cpu 4 \
  --scroll true \
  --runs 3
```

💡 **CPU throttling 가이드:**
- `--cpu 1`: 제한 없음 (기본)
- `--cpu 2`: 2배 느림 (일반 모바일)
- `--cpu 4`: 4배 느림 (저사양 모바일) ← 권장
- `--cpu 6`: 6배 느림 (매우 저사양)

### 대기 시간 조정 (느린 네트워크 시뮬레이션)
```bash
node bench/bench-webvitals.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
  --url2 "http://localhost:3000/feedback-basic/4" --name2 "Basic" \
  --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue" \
  --wait 7000 \
  --runs 5
```

### Lighthouse 공식 점수 비교
```bash
node bench/bench-lighthouse.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
  --url2 "http://localhost:3000/feedback-basic/4" --name2 "Basic" \
  --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue" \
  --runs 3
```

## 🎯 최적화 권장사항

### PDF Version 개선
- [ ] 첫 페이지 우선 렌더링
- [ ] 이미지 압축 및 최적화
- [ ] 점진적 로딩 구현

### Basic Version 개선
- [ ] PDF.js worker 최적화
- [ ] 캐싱 전략 개선
- [ ] 번들 크기 최적화

### Queue Version 개선
- [ ] 렌더 큐 우선순위 조정
- [ ] IntersectionObserver threshold 최적화
- [ ] 동시 렌더링 수 조정

## 📊 CI/CD 통합

### GitHub Actions 예제
```yaml
- name: Performance Benchmark
  run: |
    npm run dev &
    sleep 5
    npm run bench:compare
    
- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: performance-results
    path: bench/bench_out/
```

## 🐛 문제 해결

### 개발 서버가 실행되지 않음
```bash
# 별도 터미널에서 실행
npm run dev

# 준비 완료 후 벤치마크 실행
npm run bench:compare
```

### 측정값이 불안정함
- 측정 횟수 늘리기: `--runs 5` 이상
- 백그라운드 프로세스 종료
- 네트워크 안정성 확인

### 결과 차이가 미미함
- 더 긴 PDF 파일로 테스트
- 네트워크 스로틀링 추가
- 느린 디바이스에서 테스트

## 📚 참고 자료

- [Web Vitals 가이드](https://web.dev/vitals/)
- [PDF.js 최적화](https://mozilla.github.io/pdf.js/)
- [렌더링 성능 최적화](https://web.dev/rendering-performance/)

