#!/bin/bash

# PDF.js 벤치마크 100회 반복 실행 스크립트

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 총 실행 횟수
RUNS=100

echo -e "${GREEN}🚀 PDF.js 벤치마크 100회 반복 테스트 시작${NC}"
echo "총 테스트: 2가지 시나리오 × ${RUNS}회 = $((2 * RUNS))회"
echo ""

# 시작 시간 기록
START_TIME=$(date +%s)

# 1. 기본 환경 (현실적 패턴)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 시나리오 1/2: 기본 환경 (현실적 패턴, CPU 4x)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for i in $(seq 1 $RUNS); do
  echo -e "${YELLOW}=== 기본 환경 테스트 $i/$RUNS ===${NC}"
  npm run bench:longtask -- \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-기본" \
    --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-기본" \
    --realistic true
  
  # 실패 시 재시도 로직
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  실패! 10초 후 재시도...${NC}"
    sleep 10
    npm run bench:longtask -- \
      --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-기본" \
      --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-기본" \
      --realistic true
  fi
  
  # 서버 부담 감소를 위한 짧은 대기
  sleep 2
done

echo -e "${GREEN}✅ 시나리오 1/2 완료!${NC}"
echo ""

# 2. 고사양 환경
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 시나리오 2/2: 고사양 환경 (현실적 패턴, CPU 1x)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for i in $(seq 1 $RUNS); do
  echo -e "${YELLOW}=== 고사양 환경 테스트 $i/$RUNS ===${NC}"
  npm run bench:longtask -- \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-고사양" \
    --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-고사양" \
    --realistic true --cpu 1
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  실패! 10초 후 재시도...${NC}"
    sleep 10
    npm run bench:longtask -- \
      --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-고사양" \
      --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-고사양" \
      --realistic true --cpu 1
  fi
  
  sleep 2
done

echo -e "${GREEN}✅ 시나리오 2/2 완료!${NC}"
echo ""

# 종료 시간 및 총 소요 시간 계산
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
HOURS=$((TOTAL_TIME / 3600))
MINUTES=$(((TOTAL_TIME % 3600) / 60))
SECONDS=$((TOTAL_TIME % 60))

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 모든 테스트 완료!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "총 실행 횟수: $((2 * RUNS))회"
echo "총 소요 시간: ${HOURS}시간 ${MINUTES}분 ${SECONDS}초"
echo ""
echo "결과 파일은 bench/bench_out/ 디렉토리에서 확인하세요."
echo ""

