# Lighthouse 벤치마크 가이드

## 개요

`bench-lighthouse.js`는 여러 버전의 웹 페이지를 Lighthouse를 사용하여 성능 비교하는 벤치마크 도구입니다.

## 주요 기능

- 최대 3개의 서로 다른 URL/버전을 동시에 비교
- Lighthouse 공식 성능 지표만 측정 (FCP, LCP, TBT, CLS, Speed Index, TTI)
- 개별 실행 결과 및 전체 비교 결과를 JSON으로 저장
- 콘솔에서 실시간 결과 확인 가능

## 설치

```bash
cd frontend
npm install lighthouse chrome-launcher
```

## 사용 방법

### 기본 사용법 - 3개 버전 비교 (각 1회씩) ⭐

```bash
node bench/bench-lighthouse.js \
  --url1 "http://localhost:3000/feedback/4?version=old" \
  --url2 "http://localhost:3000/feedback/4?version=pdf" \
  --url3 "http://localhost:3000/feedback/4?version=new"
```

### 버전에 이름 지정하기

```bash
node bench/bench-lighthouse.js \
  --url1 "http://localhost:3000/feedback/4?version=old" --name1 "Old Version" \
  --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF Version" \
  --url3 "http://localhost:3000/feedback/4?version=new" --name3 "New Version"
```

### 1개 버전만 테스트

```bash
node bench/bench-lighthouse.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf"
```

### 여러 번 실행 (통계용)

```bash
node bench/bench-lighthouse.js \
  --url1 "http://localhost:3000/feedback/4?version=old" \
  --url2 "http://localhost:3000/feedback/4?version=pdf" \
  --url3 "http://localhost:3000/feedback/4?version=new" \
  --runs 3
```

## 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `--url1` | 첫 번째 비교 URL (필수) | - |
| `--url2` | 두 번째 비교 URL (선택) | - |
| `--url3` | 세 번째 비교 URL (선택) | - |
| `--name1` | 첫 번째 버전 이름 | "Version 1" |
| `--name2` | 두 번째 버전 이름 | "Version 2" |
| `--name3` | 세 번째 버전 이름 | "Version 3" |
| `--runs` | 각 버전당 실행 횟수 | 1 (1회씩만 실행) |

## 출력 파일

### 개별 실행 결과
- `lighthouse-{버전명}_run{번호}-{타임스탬프}.json`
- 각 실행의 상세 Lighthouse 결과 포함

### 전체 비교 요약
- `comparison-lighthouse-{타임스탬프}.json`
- 모든 버전의 통계 요약 및 원본 데이터 포함

## 측정 지표

### Performance Score
- 전체 성능 점수 (0-100)

### Core Web Vitals
- **FCP (First Contentful Paint)**: 첫 콘텐츠가 화면에 표시되는 시간
- **LCP (Largest Contentful Paint)**: 가장 큰 콘텐츠가 표시되는 시간
- **CLS (Cumulative Layout Shift)**: 레이아웃 이동 정도

### 기타 지표
- **TBT (Total Blocking Time)**: 총 차단 시간
- **Speed Index**: 페이지 콘텐츠가 시각적으로 표시되는 속도
- **TTI (Time to Interactive)**: 인터랙티브 가능 시점

## 출력 예시

```
🚀 3개 버전을 각각 1회씩 실행합니다...

######################################################################
### Version 1 시작 ###
### URL: http://localhost:3000/feedback/4?version=old
######################################################################

============================================================
Version 1 - Run 1/1 시작...
============================================================
[Lighthouse] 측정 시작: http://localhost:3000/feedback/4?version=old
[Lighthouse] 완료 - Score: 85.5

⏱️ Total Time: 12345 ms

######################################################################
### Version 2 시작 ###
### URL: http://localhost:3000/feedback/4?version=pdf
######################################################################

============================================================
Version 2 - Run 1/1 시작...
============================================================
[Lighthouse] 측정 시작: http://localhost:3000/feedback/4?version=pdf
[Lighthouse] 완료 - Score: 92.3

⏱️ Total Time: 10234 ms

######################################################################
### Version 3 시작 ###
### URL: http://localhost:3000/feedback/4?version=new
######################################################################

============================================================
Version 3 - Run 1/1 시작...
============================================================
[Lighthouse] 측정 시작: http://localhost:3000/feedback/4?version=new
[Lighthouse] 완료 - Score: 88.7

⏱️ Total Time: 11456 ms

======================================================================
📊 전체 버전 비교
======================================================================

【Version 1】
  Performance Score: 85.5 (85.5 ~ 85.5)
  FCP: 456.7ms (456.7 ~ 456.7)
  LCP: 1234.5ms (1234.5 ~ 1234.5)
  TBT: 123.4ms (123.4 ~ 123.4)
  CLS: 0.045 (0.045 ~ 0.045)
  Speed Index: 1567.8ms
  TTI: 2345.6ms

【Version 2】
  Performance Score: 92.3 (92.3 ~ 92.3)
  FCP: 345.6ms (345.6 ~ 345.6)
  LCP: 876.5ms (876.5 ~ 876.5)
  TBT: 56.7ms (56.7 ~ 56.7)
  CLS: 0.012 (0.012 ~ 0.012)
  Speed Index: 1123.4ms
  TTI: 1678.9ms

【Version 3】
  Performance Score: 88.7 (88.7 ~ 88.7)
  FCP: 398.2ms (398.2 ~ 398.2)
  LCP: 1050.3ms (1050.3 ~ 1050.3)
  TBT: 89.2ms (89.2 ~ 89.2)
  CLS: 0.028 (0.028 ~ 0.028)
  Speed Index: 1345.6ms
  TTI: 1989.4ms

📊 Comparison saved: bench_out/comparison-lighthouse-2025-10-13T19-30-45-123Z.json

✅ 모든 벤치마크 완료!
```

## 권장 사용법

1. **로컬 개발 서버 실행**: 측정할 페이지가 로딩되도록 서버를 먼저 실행하세요.

2. **빠른 비교**: 각 버전을 1회씩 실행하여 빠르게 차이를 확인하세요 (기본값).

3. **정확한 측정**: 네트워크 및 시스템 변동성을 고려하려면 `--runs 3` 옵션으로 여러 번 실행하세요.

4. **일관된 환경**: 백그라운드 프로세스를 최소화하고 동일한 시스템 환경에서 테스트하세요.

## 문제 해결

### chrome-launcher 에러
```bash
npm install lighthouse chrome-launcher
```

### Lighthouse 실행 실패
- Node.js 버전이 16 이상인지 확인
- Chrome/Chromium이 시스템에 설치되어 있는지 확인

### 비교할 URL이 없음
- 최소 `--url1`은 반드시 지정해야 합니다

### 서버가 실행 중이 아님
- 측정하려는 URL의 서버가 실행 중인지 확인하세요
- 예: `npm run dev` 또는 `npm start`

