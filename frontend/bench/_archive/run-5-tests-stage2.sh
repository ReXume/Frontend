#!/bin/bash

# 2단계: Fixed-K5 vs Adaptive 벤치마크 (세부 성능 비교)
# 목적: 고정 동시성 vs 적응형 동시성 비교

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 총 실행 횟수
RUNS=5

echo -e "${GREEN}🚀 2단계: Fixed-K5 vs Adaptive 벤치마크 (5회 반복)${NC}"
echo "목적: 고정 동시성(K=5) vs 적응형 동시성(K=1~6) 비교"
echo "총 테스트: 2가지 시나리오 × 2가지 버전 × ${RUNS}회 = $((2 * 2 * RUNS))회"
echo ""

# 출력 파일명 생성 (타임스탬프)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S-%3NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H-%M-%SZ")
OUTPUT_FILE="stage2-fixed-vs-adaptive-${TIMESTAMP}.json"

echo -e "${BLUE}📁 결과 파일: bench_out/${OUTPUT_FILE}${NC}"
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
    --url1 "http://localhost:3000/feedback/4?version=fixed" --name1 "Fixed-K5-기본" \
    --url2 "http://localhost:3000/feedback/4?version=adaptive" --name2 "Adaptive-기본" \
    --realistic true \
    --output "${OUTPUT_FILE}"
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  실패! 10초 후 재시도...${NC}"
    sleep 10
    npm run bench:longtask -- \
      --url1 "http://localhost:3000/feedback/4?version=fixed" --name1 "Fixed-K5-기본" \
      --url2 "http://localhost:3000/feedback/4?version=adaptive" --name2 "Adaptive-기본" \
      --realistic true \
      --output "${OUTPUT_FILE}"
  fi
  
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
    --url1 "http://localhost:3000/feedback/4?version=fixed" --name1 "Fixed-K5-고사양" \
    --url2 "http://localhost:3000/feedback/4?version=adaptive" --name2 "Adaptive-고사양" \
    --realistic true --cpu 1 \
    --output "${OUTPUT_FILE}"
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  실패! 10초 후 재시도...${NC}"
    sleep 10
    npm run bench:longtask -- \
      --url1 "http://localhost:3000/feedback/4?version=fixed" --name1 "Fixed-K5-고사양" \
      --url2 "http://localhost:3000/feedback/4?version=adaptive" --name2 "Adaptive-고사양" \
      --realistic true --cpu 1 \
      --output "${OUTPUT_FILE}"
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
echo -e "${GREEN}🎉 2단계 테스트 완료!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "총 실행 횟수: $((2 * RUNS))회"
echo "총 소요 시간: ${HOURS}시간 ${MINUTES}분 ${SECONDS}초"
echo ""

# ============================================================================
# 통계 요약 출력
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 2단계 결과 요약: Fixed-K5 vs Adaptive${NC}"
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
      
      // Fixed vs Adaptive 비교
      const scenarios = ['기본', '고사양'];
      
      console.log('\\n' + '='.repeat(80));
      console.log('🔍 Fixed-K5 vs Adaptive 비교');
      console.log('='.repeat(80) + '\\n');
      
      scenarios.forEach(scenario => {
        const fixed = data.averages['Fixed-K5-' + scenario];
        const adaptive = data.averages['Adaptive-' + scenario];
        
        if (fixed && adaptive) {
          console.log('📊 ' + scenario + ' 환경');
          console.log('─'.repeat(80));
          console.log('버전'.padEnd(25) + 'TBT (ms)'.padEnd(18) + 'LongTask (개)'.padEnd(18) + '렌더 페이지');
          console.log('─'.repeat(80));
          
          // Fixed-K5
          console.log('Fixed-K5 (고정)'.padEnd(25) + 
            fixed.totalBlockingTime.avg.toFixed(1).padEnd(18) + 
            fixed.longTasks.avg.toFixed(1).padEnd(18) + 
            fixed.renderEvents.avg.toFixed(1));
          
          // Adaptive
          const adaptiveTbtDiff = fixed.totalBlockingTime.avg - adaptive.totalBlockingTime.avg;
          const adaptiveTbtPct = (adaptiveTbtDiff / fixed.totalBlockingTime.avg * 100);
          console.log('Adaptive (자동 조절)'.padEnd(25) + 
            adaptive.totalBlockingTime.avg.toFixed(1).padEnd(18) + 
            adaptive.longTasks.avg.toFixed(1).padEnd(18) + 
            adaptive.renderEvents.avg.toFixed(1) + 
            '  (' + (adaptiveTbtDiff > 0 ? '✅ -' : '❌ +') + Math.abs(adaptiveTbtDiff).toFixed(1) + 'ms, ' + adaptiveTbtPct.toFixed(1) + '%)');
          
          console.log('');
        }
      });
      
      // 결론
      const fixedBasic = data.averages['Fixed-K5-기본'];
      const adaptiveBasic = data.averages['Adaptive-기본'];
      
      if (fixedBasic && adaptiveBasic) {
        const improvement = ((fixedBasic.totalBlockingTime.avg - adaptiveBasic.totalBlockingTime.avg) / fixedBasic.totalBlockingTime.avg * 100);
        console.log('\\n💡 결론:');
        if (improvement > 10) {
          console.log('   ✅ Adaptive가 Fixed-K5보다 훨씬 우수합니다! (TBT ' + improvement.toFixed(1) + '% 추가 개선)');
          console.log('   → 적응형 스케줄러를 사용하세요.');
        } else if (improvement > 3) {
          console.log('   ✓ Adaptive가 Fixed-K5보다 약간 우수합니다. (TBT ' + improvement.toFixed(1) + '% 추가 개선)');
        } else if (improvement > -3) {
          console.log('   ≈ Adaptive와 Fixed-K5가 비슷합니다. (TBT ' + improvement.toFixed(1) + '% 차이)');
          console.log('   → Fixed-K5만으로도 충분합니다.');
        } else {
          console.log('   ⚠️  Fixed-K5가 Adaptive보다 우수합니다. (TBT ' + Math.abs(improvement).toFixed(1) + '% 더 나쁨)');
          console.log('   → 적응형 로직을 재검토하세요.');
        }
      }
    }
  " 2>/dev/null || echo "⚠️  결과 요약 생성 실패"
else
  echo "⚠️  결과 파일을 찾을 수 없습니다: ${RESULT_FILE}"
fi

echo ""
echo -e "${GREEN}🔗 결과 파일: bench_out/${OUTPUT_FILE}${NC}"

