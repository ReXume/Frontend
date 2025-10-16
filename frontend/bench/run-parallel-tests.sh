#!/bin/bash

# PDF.js 벤치마크 병렬 실행 스크립트
# 3개의 브라우저 인스턴스를 동시에 실행하여 빠르게 측정

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 총 실행 횟수 (각 시나리오당)
RUNS=25

# 병렬 실행 수 (동시에 실행할 브라우저 개수)
PARALLEL_JOBS=3

echo -e "${GREEN}🚀 PDF.js 벤치마크 병렬 실행 (3개 동시)${NC}"
echo "각 시나리오당 ${RUNS}회, 총 $((3 * RUNS))회"
echo "병렬 작업 수: ${PARALLEL_JOBS}개 동시 실행"
echo ""
echo -e "${YELLOW}⚠️  주의: CPU/메모리 사용량이 높을 수 있습니다${NC}"
echo ""

# 시작 시간 기록
START_TIME=$(date +%s)

# 함수: 단일 테스트 실행
run_test() {
  local scenario=$1
  local run_num=$2
  local total=$3
  
  case $scenario in
    "basic")
      echo "[$run_num/$total] 기본 환경 테스트 중..."
      npm run bench:longtask -- \
        --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-기본-$run_num" \
        --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-기본-$run_num" \
        --realistic true --headless true > /dev/null 2>&1
      ;;
    "highend")
      echo "[$run_num/$total] 고사양 환경 테스트 중..."
      npm run bench:longtask -- \
        --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-고사양-$run_num" \
        --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-고사양-$run_num" \
        --realistic true --cpu 1 --headless true > /dev/null 2>&1
      ;;
    "slow")
      echo "[$run_num/$total] 천천히 읽기 테스트 중..."
      npm run bench:longtask -- \
        --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-느림-$run_num" \
        --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-느림-$run_num" \
        --delay 2000 --steps 8 --headless true > /dev/null 2>&1
      ;;
  esac
}

# 1. 기본 환경 - 병렬 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 시나리오 1/3: 기본 환경 (${RUNS}회 병렬 실행)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

export -f run_test
seq 1 $RUNS | xargs -n 1 -P $PARALLEL_JOBS -I {} bash -c "run_test basic {} $RUNS"

echo -e "${GREEN}✅ 시나리오 1/3 완료!${NC}"
echo ""

# 잠시 대기 (서버 안정화)
sleep 5

# 2. 고사양 환경 - 병렬 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 시나리오 2/3: 고사양 환경 (${RUNS}회 병렬 실행)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

seq 1 $RUNS | xargs -n 1 -P $PARALLEL_JOBS -I {} bash -c "run_test highend {} $RUNS"

echo -e "${GREEN}✅ 시나리오 2/3 완료!${NC}"
echo ""

sleep 5

# 3. 천천히 읽기 - 병렬 실행
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 시나리오 3/3: 천천히 읽기 (${RUNS}회 병렬 실행)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

seq 1 $RUNS | xargs -n 1 -P $PARALLEL_JOBS -I {} bash -c "run_test slow {} $RUNS"

echo -e "${GREEN}✅ 시나리오 3/3 완료!${NC}"
echo ""

# 종료 시간 및 총 소요 시간 계산
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
HOURS=$((TOTAL_TIME / 3600))
MINUTES=$(((TOTAL_TIME % 3600) / 60))
SECONDS=$((TOTAL_TIME % 60))

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 모든 병렬 테스트 완료!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "총 실행 횟수: $((3 * RUNS))회"
echo "병렬 작업 수: ${PARALLEL_JOBS}개 동시 실행"
echo "총 소요 시간: ${HOURS}시간 ${MINUTES}분 ${SECONDS}초"
echo ""
echo -e "${BLUE}💡 순차 실행 대비 약 ${PARALLEL_JOBS}배 빠름!${NC}"
echo ""
echo "결과 파일은 bench/bench_out/ 디렉토리에서 확인하세요."
echo ""

