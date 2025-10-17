#!/bin/bash

# PDF.js 벤치마크 10회 반복 실행 스크립트 - 3가지 버전 비교

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 총 실행 횟수
RUNS=10

echo -e "${GREEN}🚀 PDF.js 벤치마크 10회 반복 테스트 시작${NC}"
echo "총 테스트: 3가지 시나리오 × ${RUNS}회 = $((3 * RUNS))회"
echo ""

# 출력 파일명 생성 (타임스탬프)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S-%3NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H-%M-%SZ")
OUTPUT_FILE="benchmark-results-${TIMESTAMP}.json"

echo -e "${BLUE}📁 결과 파일: bench_out/${OUTPUT_FILE}${NC}"
echo ""

# 시작 시간 기록
START_TIME=$(date +%s)

# 1. 기본 환경 (현실적 패턴)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 시나리오 1/3: 기본 환경 (현실적 패턴, CPU 4x)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for i in $(seq 1 $RUNS); do
  echo -e "${YELLOW}=== 기본 환경 테스트 $i/$RUNS ===${NC}"
  npm run bench:longtask -- \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "IntersectionObserver-기본" \
    --url2 "http://localhost:3000/feedback/4?version=fixed" --name2 "Fixed-K5-기본" \
    --url3 "http://localhost:3000/feedback/4?version=adaptive" --name3 "Adaptive-기본" \
    --realistic true \
    --output "${OUTPUT_FILE}"
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  실패! 10초 후 재시도...${NC}"
    sleep 10
    npm run bench:longtask -- \
      --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "IntersectionObserver-기본" \
      --url2 "http://localhost:3000/feedback/4?version=fixed" --name2 "Fixed-K5-기본" \
      --url3 "http://localhost:3000/feedback/4?version=adaptive" --name3 "Adaptive-기본" \
      --realistic true \
      --output "${OUTPUT_FILE}"
  fi
  
  sleep 2
done

echo -e "${GREEN}✅ 시나리오 1/3 완료!${NC}"
echo ""

# 2. 고사양 환경
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 시나리오 2/3: 고사양 환경 (현실적 패턴, CPU 1x)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for i in $(seq 1 $RUNS); do
  echo -e "${YELLOW}=== 고사양 환경 테스트 $i/$RUNS ===${NC}"
  npm run bench:longtask -- \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "IntersectionObserver-고사양" \
    --url2 "http://localhost:3000/feedback/4?version=fixed" --name2 "Fixed-K5-고사양" \
    --url3 "http://localhost:3000/feedback/4?version=adaptive" --name3 "Adaptive-고사양" \
    --realistic true --cpu 1 \
    --output "${OUTPUT_FILE}"
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  실패! 10초 후 재시도...${NC}"
    sleep 10
    npm run bench:longtask -- \
      --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "IntersectionObserver-고사양" \
      --url2 "http://localhost:3000/feedback/4?version=fixed" --name2 "Fixed-K5-고사양" \
      --url3 "http://localhost:3000/feedback/4?version=adaptive" --name3 "Adaptive-고사양" \
      --realistic true --cpu 1 \
      --output "${OUTPUT_FILE}"
  fi
  
  sleep 2
done

echo -e "${GREEN}✅ 시나리오 2/3 완료!${NC}"
echo ""

# 3. 저사양 환경 
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 시나리오 3/3: 저사양 환경 (현실적 패턴, CPU 6x)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for i in $(seq 1 $RUNS); do
  echo -e "${YELLOW}=== 저사양 환경 테스트 $i/$RUNS ===${NC}"
  npm run bench:longtask -- \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "IntersectionObserver-저사양" \
    --url2 "http://localhost:3000/feedback/4?version=fixed" --name2 "Fixed-K5-저사양" \
    --url3 "http://localhost:3000/feedback/4?version=adaptive" --name3 "Adaptive-저사양" \
    --realistic true --cpu 6 \
    --output "${OUTPUT_FILE}"
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  실패! 10초 후 재시도...${NC}"
    sleep 10
    npm run bench:longtask -- \
      --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "IntersectionObserver-저사양" \
      --url2 "http://localhost:3000/feedback/4?version=fixed" --name2 "Fixed-K5-저사양" \
      --url3 "http://localhost:3000/feedback/4?version=adaptive" --name3 "Adaptive-저사양" \
      --realistic true --cpu 6 \
      --output "${OUTPUT_FILE}"
  fi
  
  sleep 2
done

echo -e "${GREEN}✅ 시나리오 3/3 완료!${NC}"
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
echo "총 실행 횟수: $((3 * RUNS))회"
echo "총 소요 시간: ${HOURS}시간 ${MINUTES}분 ${SECONDS}초"
echo ""

# ============================================================================
# 통계 요약 출력
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 전체 통계 요약 (최근 결과)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 결과 파일 경로
RESULT_FILE="bench_out/${OUTPUT_FILE}"

if [ -f "$RESULT_FILE" ]; then
  echo "📂 파일: ${OUTPUT_FILE}"
  echo ""
  node -e "
    const fs = require('fs');
    const data = JSON.parse(fs.readFileSync('${RESULT_FILE}', 'utf8'));
    
    console.log('총 측정 횟수:', data.totalMeasurements + '회\\n');
    
    if (data.averages) {
      Object.entries(data.averages).forEach(([version, avg]) => {
        console.log('🔹', version, '(n=' + avg.count + (avg.excluded > 0 ? ', 제외: ' + avg.excluded : '') + ')');
        console.log('─'.repeat(80));
        console.log('   렌더링된 페이지:   ', avg.renderEvents.avg.toFixed(1) + '개');
        if (avg.renderEfficiency) {
          console.log('   렌더링 효율:       ', avg.renderEfficiency.avg.toFixed(2), 'pages/sec');
        }
        console.log('   LongTask:          ', avg.longTasks.avg.toFixed(1) + '개');
        console.log('   TBT:               ', avg.totalBlockingTime.avg.toFixed(1) + 'ms');
        console.log('   sendWithPromise:   ', avg.sendWithPromise.avg.toFixed(1) + '회');
        console.log('');
      });
      
      // 3가지 버전 비교
      const scenarios = ['기본', '고사양', '저사양'];
      
      console.log('\\n' + '='.repeat(80));
      console.log('🔍 3가지 버전 비교 (IntersectionObserver vs Fixed-K5 vs Adaptive)');
      console.log('='.repeat(80) + '\\n');
      
      scenarios.forEach(scenario => {
        const observer = data.averages['IntersectionObserver-' + scenario];
        const fixed = data.averages['Fixed-K5-' + scenario];
        const adaptive = data.averages['Adaptive-' + scenario];
        
        if (observer && fixed && adaptive) {
          console.log('📊 ' + scenario + ' 환경');
          console.log('─'.repeat(80));
          console.log('버전'.padEnd(25) + 'TBT (ms)'.padEnd(18) + 'LongTask (개)'.padEnd(18) + '렌더 페이지');
          console.log('─'.repeat(80));
          
          // IntersectionObserver
          console.log('IntersectionObserver'.padEnd(25) + 
            observer.totalBlockingTime.avg.toFixed(1).padEnd(18) + 
            observer.longTasks.avg.toFixed(1).padEnd(18) + 
            observer.renderEvents.avg.toFixed(1));
          
          // Fixed-K5
          const fixedTbtDiff = observer.totalBlockingTime.avg - fixed.totalBlockingTime.avg;
          const fixedLtDiff = observer.longTasks.avg - fixed.longTasks.avg;
          console.log('Fixed-K5'.padEnd(25) + 
            fixed.totalBlockingTime.avg.toFixed(1).padEnd(18) + 
            fixed.longTasks.avg.toFixed(1).padEnd(18) + 
            fixed.renderEvents.avg.toFixed(1) + 
            '  (' + (fixedTbtDiff > 0 ? '✅ -' : '❌ +') + Math.abs(fixedTbtDiff).toFixed(1) + 'ms)');
          
          // Adaptive
          const adaptiveTbtDiff = observer.totalBlockingTime.avg - adaptive.totalBlockingTime.avg;
          const adaptiveLtDiff = observer.longTasks.avg - adaptive.longTasks.avg;
          console.log('Adaptive'.padEnd(25) + 
            adaptive.totalBlockingTime.avg.toFixed(1).padEnd(18) + 
            adaptive.longTasks.avg.toFixed(1).padEnd(18) + 
            adaptive.renderEvents.avg.toFixed(1) + 
            '  (' + (adaptiveTbtDiff > 0 ? '✅ -' : '❌ +') + Math.abs(adaptiveTbtDiff).toFixed(1) + 'ms)');
          
          console.log('');
        }
      });
    }
  " 2>/dev/null || echo "⚠️  결과 요약 생성 실패"
else
  echo "⚠️  결과 파일을 찾을 수 없습니다: ${RESULT_FILE}"
fi

echo ""
echo -e "${GREEN}🔗 결과 파일: bench_out/${OUTPUT_FILE}${NC}"
