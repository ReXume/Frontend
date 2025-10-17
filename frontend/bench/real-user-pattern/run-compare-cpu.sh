#!/bin/bash
# CPU 스로틀링 비교 테스트 실행 스크립트
# 
# CPU 4x (저사양) vs CPU 1x (일반) 환경을 비교합니다.
# 
# 사용법:
#   ./run-compare-cpu.sh [실행횟수]
#   예: ./run-compare-cpu.sh 3  # 각 CPU 설정별로 3회씩 실행

echo "🚀 CPU 스로틀링 비교 테스트 시작"
echo "════════════════════════════════════════════════════════════════"
echo ""

# 실행 횟수 (기본값: 3회)
RUNS=${1:-3}

echo "⚙️  설정:"
echo "   - 실행 횟수: 각 CPU 설정별로 ${RUNS}회"
echo "   - CPU 설정: 4x (저사양) vs 1x (일반)"
echo "   - 패턴: 스크롤 → 읽기 → 반복"
echo "   - 비교 버전: PDF vs Queue"
echo ""

# 현재 스크립트 디렉토리로 이동
cd "$(dirname "$0")"

# 결과 파일 이름 생성 (타임스탬프)
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
OUTPUT_FILE="./results/cpu-compare-${TIMESTAMP}.json"

echo "📁 결과 파일: ${OUTPUT_FILE}"
echo ""

# 시작 시간 기록
START_TIME=$(date +%s)

# ============================================================
# 1. CPU 4x 스로틀링 테스트
# ============================================================
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "1️⃣  CPU 4x 스로틀링 테스트 (저사양 환경)"
echo "════════════════════════════════════════════════════════════════"

for i in $(seq 1 ${RUNS}); do
  echo ""
  echo "────────────────────────────────────────────────────────────────"
  echo "🔄 [CPU 4x] 실행 ${i}/${RUNS}"
  echo "────────────────────────────────────────────────────────────────"
  
  node bench-pdfjs-longtasks.js \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-4x" \
    --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-4x" \
    --cpu 4 \
    --realistic true \
    --output "${OUTPUT_FILE}"
  
  CPU4X_STATUS=$?
  
  if [ $CPU4X_STATUS -ne 0 ]; then
    echo "❌ [CPU 4x] 실행 ${i} 실패"
  else
    echo "✅ [CPU 4x] 실행 ${i} 완료"
  fi
  
  # 마지막 실행이 아니면 잠깐 대기
  if [ $i -lt ${RUNS} ]; then
    echo "⏱️  다음 실행까지 3초 대기..."
    sleep 3
  fi
done

echo ""
echo "✅ CPU 4x 스로틀링 테스트 완료"

# ============================================================
# 2. CPU 1x (스로틀링 없음) 테스트
# ============================================================
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "2️⃣  CPU 1x 테스트 (일반 환경, 스로틀링 없음)"
echo "════════════════════════════════════════════════════════════════"

for i in $(seq 1 ${RUNS}); do
  echo ""
  echo "────────────────────────────────────────────────────────────────"
  echo "🔄 [CPU 1x] 실행 ${i}/${RUNS}"
  echo "────────────────────────────────────────────────────────────────"
  
  node bench-pdfjs-longtasks.js \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-1x" \
    --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-1x" \
    --cpu 1 \
    --realistic true \
    --output "${OUTPUT_FILE}"
  
  CPU1X_STATUS=$?
  
  if [ $CPU1X_STATUS -ne 0 ]; then
    echo "❌ [CPU 1x] 실행 ${i} 실패"
  else
    echo "✅ [CPU 1x] 실행 ${i} 완료"
  fi
  
  # 마지막 실행이 아니면 잠깐 대기
  if [ $i -lt ${RUNS} ]; then
    echo "⏱️  다음 실행까지 3초 대기..."
    sleep 3
  fi
done

echo ""
echo "✅ CPU 1x 테스트 완료"

# 종료 시간 및 총 소요 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# 최종 결과 요약
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 CPU 스로틀링 비교 테스트 결과"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "✅ 모든 테스트 완료!"
echo ""
echo "⏱️  총 소요 시간: ${MINUTES}분 ${SECONDS}초"
echo ""
echo "📁 결과 파일: ${OUTPUT_FILE}"
echo ""
echo "💡 최종 평균 요약은 위의 테이블에서 확인하세요!"
echo "   4가지 버전이 비교되었습니다:"
echo "     1. PDF-4x  (CPU 4x 스로틀링)"
echo "     2. Queue-4x (CPU 4x 스로틀링)"
echo "     3. PDF-1x  (스로틀링 없음)"
echo "     4. Queue-1x (스로틀링 없음)"
echo ""
echo "════════════════════════════════════════════════════════════════"

