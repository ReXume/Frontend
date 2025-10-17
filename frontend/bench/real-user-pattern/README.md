# 실사용자 패턴 테스트

실제 사용자의 문서 읽기 패턴을 시뮬레이션합니다.

## 빠른 실행

### 기본 테스트 (CPU 4x 고정)

```bash
# 기본 실행 (3회, CPU 4x throttle)
./run-test.sh

# 실행 횟수 지정 (5회)
./run-test.sh 5
```

### CPU 스로틀링 비교 테스트 ⭐

```bash
# CPU 4x vs 1x 비교 (각각 3회씩)
./run-compare-cpu.sh

# 실행 횟수 지정 (각각 5회씩)
./run-compare-cpu.sh 5
```

**비교 결과**: 4가지 버전의 평균을 한 번에 확인 가능
- `PDF-4x` vs `Queue-4x` (저사양 환경)
- `PDF-1x` vs `Queue-1x` (일반 환경)

## 시뮬레이션 패턴

실제 사용자처럼 행동합니다:

1. 🔽 빠르게 스크롤하여 내용 훑어보기
2. 📖 관심 있는 부분에서 정지하여 읽기 (1.5초)
3. 🔼 이전 내용 확인을 위해 위로 스크롤하기
4. 🔁 반복

## 비교 버전

- **PDF**: 일반 PDF 렌더링
- **Queue**: 우선순위 큐 기반 렌더링

## 측정 지표

- 렌더 이벤트 수 & 효율
- sendWithPromise 호출 빈도
- Long Tasks 발생 패턴
- Total Blocking Time
- 이벤트 타임라인 분석

## 상관관계 분석

- 스크롤 → sendWithPromise
- sendWithPromise → LongTask
- 스크롤 → LongTask

## 결과 확인

결과는 `./results/` 폴더에 저장됩니다.

자세한 내용은 [메인 README](../README.md)를 참조하세요.

