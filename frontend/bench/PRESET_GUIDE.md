# 프리셋 가이드

벤치마크 프리셋은 여러 설정을 한 번에 적용하는 편리한 방법입니다.

## 🎯 프리셋 종류

### 1. `realistic` (권장) ⭐
**실제 사용자 환경 시뮬레이션**

```bash
npm run bench:webvitals -- --preset realistic
```

**설정:**
- `wait`: 7000ms (충분한 PDF 렌더링 시간)
- `scroll`: true (사용자 스크롤 시뮬레이션)
- `cpu`: 2x (일반 모바일 디바이스)
- `scrollIntensive`: true (더 많은 스크롤)

**용도:**
- ✅ 실제 성능 측정에 가장 적합
- ✅ 프로덕션 환경과 유사
- ✅ Basic 580ms, Queue 330ms에 근접한 결과

**측정 시간:** ~10초/URL

---

### 2. `fast` ⚡
**빠른 측정 (개발 중)**

```bash
npm run bench:webvitals -- --preset fast
```

**설정:**
- `wait`: 2000ms
- `scroll`: false
- `cpu`: 1x (제한 없음)
- `scrollIntensive`: false

**용도:**
- ✅ 빠른 피드백
- ✅ 개발 중 간단 확인
- ⚠️ 실제 성능과 차이 있을 수 있음

**측정 시간:** ~4초/URL

---

### 3. `intensive` 🔥
**강도 높은 측정 (저사양 환경)**

```bash
npm run bench:webvitals -- --preset intensive
```

**설정:**
- `wait`: 10000ms
- `scroll`: true
- `cpu`: 4x (저사양 모바일)
- `scrollIntensive`: true

**용도:**
- ✅ 최악의 시나리오 테스트
- ✅ 저사양 디바이스 성능 확인
- ⚠️ 실제보다 과도하게 느림

**측정 시간:** ~15초/URL

---

## 📊 프리셋 비교

| 프리셋 | wait | scroll | CPU | 용도 | 측정 시간 | 정확도 |
|--------|------|--------|-----|------|----------|--------|
| **realistic** ⭐ | 7s | ✅ | 2x | 실제 환경 | 10s | ⭐⭐⭐⭐⭐ |
| **fast** | 2s | ❌ | 1x | 빠른 확인 | 4s | ⭐⭐⭐ |
| **intensive** | 10s | ✅ | 4x | 저사양 | 15s | ⭐⭐⭐⭐ |

---

## 🚀 사용 예시

### 3가지 버전 비교 (realistic)

```bash
# 방법 1: npm script (가장 간단)
npm run bench:compare:realistic

# 방법 2: 직접 실행
node bench/bench-webvitals.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
  --url2 "http://localhost:3000/feedback-basic/4" --name2 "Basic" \
  --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue" \
  --preset realistic \
  --runs 3
```

### 빠른 개발 중 확인 (fast)

```bash
npm run bench:webvitals -- --url "http://localhost:3000" --preset fast
```

### 저사양 환경 테스트 (intensive)

```bash
npm run bench:webvitals -- \
  --url "http://localhost:3000/feedback/4" \
  --preset intensive \
  --runs 3
```

---

## 🎯 실제 측정값과 비교

### 실제 사용자 환경 측정값
- Basic Version TBT: **580ms**
- Queue Version TBT: **330ms**

### realistic 프리셋 결과
- Basic Version TBT: **532ms** (차이 48ms, 8%)
- Queue Version TBT: **358ms** (차이 28ms, 8%)

✅ **realistic 프리셋이 가장 정확합니다!**

---

## 🔧 커스텀 설정

프리셋 대신 개별 옵션으로 세밀하게 조정:

```bash
node bench/bench-webvitals.js \
  --url "..." \
  --wait 7000 \
  --scroll true \
  --scrollIntensive true \
  --cpu 2 \
  --runs 3
```

**프리셋보다 우선순위가 높습니다:**
```bash
# realistic 프리셋 + CPU만 4배로 변경
node bench/bench-webvitals.js \
  --url "..." \
  --preset realistic \
  --cpu 4  # 이 값이 우선 적용됨
```

---

## 💡 프리셋 선택 가이드

### 언제 `realistic`을 사용하나요?
- ✅ 프로덕션 배포 전 성능 검증
- ✅ 여러 버전 비교
- ✅ 성능 개선 효과 측정
- ✅ CI/CD 파이프라인

### 언제 `fast`를 사용하나요?
- ✅ 개발 중 빠른 피드백
- ✅ 코드 변경 후 간단 확인
- ✅ 로컬 개발

### 언제 `intensive`를 사용하나요?
- ✅ 저사양 디바이스 대응 확인
- ✅ 최악의 시나리오 테스트
- ✅ 성능 최적화 목표 설정

---

## 📚 관련 문서

- [WEBVITALS_BENCH_README.md](./WEBVITALS_BENCH_README.md) - Web Vitals 벤치마크 가이드
- [METRICS_CALCULATION.md](./METRICS_CALCULATION.md) - 지표 계산 방식
- [COMPARE_GUIDE.md](./COMPARE_GUIDE.md) - 3가지 버전 비교 가이드

