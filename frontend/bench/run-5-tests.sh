#!/bin/bash

# PDF.js 벤치마크 5회 반복 실행 스크립트

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 총 실행 횟수
RUNS=5

echo -e "${GREEN}🚀 PDF.js 벤치마크 5회 반복 테스트 시작${NC}"
echo "총 테스트: 2가지 시나리오 × ${RUNS}회 = $((2 * RUNS))회"
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
echo -e "${BLUE}📊 시나리오 1/2: 기본 환경 (현실적 패턴, CPU 4x)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for i in $(seq 1 $RUNS); do
  echo -e "${YELLOW}=== 기본 환경 테스트 $i/$RUNS ===${NC}"
  npm run bench:longtask -- \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-기본" \
    --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-기본" \
    --realistic true \
    --output "${OUTPUT_FILE}"
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  실패! 10초 후 재시도...${NC}"
    sleep 10
    npm run bench:longtask -- \
      --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-기본" \
      --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-기본" \
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
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-고사양" \
    --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-고사양" \
    --realistic true --cpu 1 \
    --output "${OUTPUT_FILE}"
  
  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  실패! 10초 후 재시도...${NC}"
    sleep 10
    npm run bench:longtask -- \
      --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-고사양" \
      --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-고사양" \
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
echo -e "${GREEN}🎉 모든 테스트 완료!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "총 실행 횟수: $((2 * RUNS))회"
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
      
      // 버전 비교 (기본, 고사양만)
      const versions = Object.keys(data.averages);
      const pdfVersions = versions.filter(v => v.startsWith('PDF-') && (v === 'PDF-기본' || v === 'PDF-고사양'));
      
      if (pdfVersions.length > 0) {
        console.log('\\n' + '='.repeat(80));
        console.log('🔍 버전 비교 (기본 & 고사양)');
        console.log('='.repeat(80) + '\\n');
        
        pdfVersions.forEach(pdfVer => {
          const suffix = pdfVer.replace('PDF-', '');
          const queueVer = 'Queue-' + suffix;
          
          if (data.averages[queueVer]) {
            const pdf = data.averages[pdfVer];
            const queue = data.averages[queueVer];
            
            console.log('📊', suffix);
            console.log('─'.repeat(80));
            
            const renderPages = ((queue.renderEvents.avg - pdf.renderEvents.avg) / pdf.renderEvents.avg * 100);
            console.log('   렌더링 페이지:', pdf.renderEvents.avg.toFixed(1) + '개 →', queue.renderEvents.avg.toFixed(1) + '개  (' + (renderPages > 0 ? '✅' : '❌'), renderPages.toFixed(1) + '%)');
            
            if (pdf.renderEfficiency && queue.renderEfficiency) {
              const eff = ((queue.renderEfficiency.avg - pdf.renderEfficiency.avg) / pdf.renderEfficiency.avg * 100);
              console.log('   렌더링 효율:  ', pdf.renderEfficiency.avg.toFixed(2), '→', queue.renderEfficiency.avg.toFixed(2), 'pages/sec  (' + (eff > 0 ? '✅' : '❌'), eff.toFixed(1) + '%)');
            }
            
            const tbt = ((pdf.totalBlockingTime.avg - queue.totalBlockingTime.avg) / pdf.totalBlockingTime.avg * 100);
            const lt = ((pdf.longTasks.avg - queue.longTasks.avg) / pdf.longTasks.avg * 100);
            const send = ((pdf.sendWithPromise.avg - queue.sendWithPromise.avg) / pdf.sendWithPromise.avg * 100);
            
            console.log('   TBT:          ', pdf.totalBlockingTime.avg.toFixed(1) + 'ms →', queue.totalBlockingTime.avg.toFixed(1) + 'ms  (' + (tbt > 0 ? '✅' : '❌'), tbt.toFixed(1) + '%)');
            console.log('   LongTask:     ', pdf.longTasks.avg.toFixed(1) + '개 →', queue.longTasks.avg.toFixed(1) + '개  (' + (lt > 0 ? '✅' : '❌'), lt.toFixed(1) + '%)');
            console.log('   sendWithPromise:', pdf.sendWithPromise.avg.toFixed(1) + '회 →', queue.sendWithPromise.avg.toFixed(1) + '회  (' + (send > 0 ? '✅' : '❌'), send.toFixed(1) + '%)');
            console.log('');
          }
        });
      }
      
      // 저사양 vs 고사양 개선율 비교
      if (data.averages['PDF-기본'] && data.averages['Queue-기본'] && 
          data.averages['PDF-고사양'] && data.averages['Queue-고사양']) {
        console.log('\\n\\n' + '='.repeat(80));
        console.log('🔍 저사양 vs 고사양 환경 상세 비교');
        console.log('='.repeat(80) + '\\n');
        
        const pdfBasic = data.averages['PDF-기본'];
        const queueBasic = data.averages['Queue-기본'];
        const pdfHigh = data.averages['PDF-고사양'];
        const queueHigh = data.averages['Queue-고사양'];
        
        console.log('📊 저사양 환경 (CPU 4x throttle)');
        console.log('─'.repeat(80));
        console.log('메트릭'.padEnd(25) + 'PDF'.padEnd(18) + 'Queue'.padEnd(18) + '개선율');
        console.log('─'.repeat(80));
        
        const renderPagesBasic = ((queueBasic.renderEvents.avg - pdfBasic.renderEvents.avg) / pdfBasic.renderEvents.avg * 100);
        const effBasic = pdfBasic.renderEfficiency && queueBasic.renderEfficiency
          ? ((queueBasic.renderEfficiency.avg - pdfBasic.renderEfficiency.avg) / pdfBasic.renderEfficiency.avg * 100)
          : 0;
        const tbtBasic = ((pdfBasic.totalBlockingTime.avg - queueBasic.totalBlockingTime.avg) / pdfBasic.totalBlockingTime.avg * 100);
        const ltBasic = ((pdfBasic.longTasks.avg - queueBasic.longTasks.avg) / pdfBasic.longTasks.avg * 100);
        const sendBasic = ((pdfBasic.sendWithPromise.avg - queueBasic.sendWithPromise.avg) / pdfBasic.sendWithPromise.avg * 100);
        
        console.log('렌더링 페이지'.padEnd(25) + 
          (pdfBasic.renderEvents.avg.toFixed(1) + '개').padEnd(18) + 
          (queueBasic.renderEvents.avg.toFixed(1) + '개').padEnd(18) + 
          (renderPagesBasic > 0 ? '✅ +' : renderPagesBasic < 0 ? '❌ ' : '➖ ') + renderPagesBasic.toFixed(1) + '%');
        
        console.log('렌더링 효율'.padEnd(25) + 
          (pdfBasic.renderEfficiency.avg.toFixed(2) + ' p/s').padEnd(18) + 
          (queueBasic.renderEfficiency.avg.toFixed(2) + ' p/s').padEnd(18) + 
          (effBasic > 0 ? '✅ +' : effBasic < 0 ? '❌ ' : '➖ ') + effBasic.toFixed(1) + '%');
        
        console.log('TBT'.padEnd(25) + 
          (pdfBasic.totalBlockingTime.avg.toFixed(0) + 'ms').padEnd(18) + 
          (queueBasic.totalBlockingTime.avg.toFixed(0) + 'ms').padEnd(18) + 
          (tbtBasic > 0 ? '✅ -' : tbtBasic < 0 ? '❌ +' : '➖ ') + Math.abs(tbtBasic).toFixed(1) + '%');
        
        console.log('LongTask 개수'.padEnd(25) + 
          (pdfBasic.longTasks.avg.toFixed(1) + '개').padEnd(18) + 
          (queueBasic.longTasks.avg.toFixed(1) + '개').padEnd(18) + 
          (ltBasic > 0 ? '✅ -' : ltBasic < 0 ? '❌ +' : '➖ ') + Math.abs(ltBasic).toFixed(1) + '%');
        
        console.log('sendWithPromise 호출'.padEnd(25) + 
          (pdfBasic.sendWithPromise.avg.toFixed(1) + '회').padEnd(18) + 
          (queueBasic.sendWithPromise.avg.toFixed(1) + '회').padEnd(18) + 
          (sendBasic > 0 ? '✅ -' : sendBasic < 0 ? '❌ +' : '➖ ') + Math.abs(sendBasic).toFixed(1) + '%');
        
        console.log('\\n📊 고사양 환경 (CPU 1x throttle)');
        console.log('─'.repeat(80));
        console.log('메트릭'.padEnd(25) + 'PDF'.padEnd(18) + 'Queue'.padEnd(18) + '개선율');
        console.log('─'.repeat(80));
        
        const renderPagesHigh = ((queueHigh.renderEvents.avg - pdfHigh.renderEvents.avg) / pdfHigh.renderEvents.avg * 100);
        const effHigh = pdfHigh.renderEfficiency && queueHigh.renderEfficiency
          ? ((queueHigh.renderEfficiency.avg - pdfHigh.renderEfficiency.avg) / pdfHigh.renderEfficiency.avg * 100)
          : 0;
        const tbtHigh = ((pdfHigh.totalBlockingTime.avg - queueHigh.totalBlockingTime.avg) / pdfHigh.totalBlockingTime.avg * 100);
        const ltHigh = ((pdfHigh.longTasks.avg - queueHigh.longTasks.avg) / pdfHigh.longTasks.avg * 100);
        const sendHigh = ((pdfHigh.sendWithPromise.avg - queueHigh.sendWithPromise.avg) / pdfHigh.sendWithPromise.avg * 100);
        
        console.log('렌더링 페이지'.padEnd(25) + 
          (pdfHigh.renderEvents.avg.toFixed(1) + '개').padEnd(18) + 
          (queueHigh.renderEvents.avg.toFixed(1) + '개').padEnd(18) + 
          (renderPagesHigh > 0 ? '✅ +' : renderPagesHigh < 0 ? '❌ ' : '➖ ') + renderPagesHigh.toFixed(1) + '%');
        
        console.log('렌더링 효율'.padEnd(25) + 
          (pdfHigh.renderEfficiency.avg.toFixed(2) + ' p/s').padEnd(18) + 
          (queueHigh.renderEfficiency.avg.toFixed(2) + ' p/s').padEnd(18) + 
          (effHigh > 0 ? '✅ +' : effHigh < 0 ? '❌ ' : '➖ ') + effHigh.toFixed(1) + '%');
        
        console.log('TBT'.padEnd(25) + 
          (pdfHigh.totalBlockingTime.avg.toFixed(0) + 'ms').padEnd(18) + 
          (queueHigh.totalBlockingTime.avg.toFixed(0) + 'ms').padEnd(18) + 
          (tbtHigh > 0 ? '✅ -' : tbtHigh < 0 ? '❌ +' : '➖ ') + Math.abs(tbtHigh).toFixed(1) + '%');
        
        console.log('LongTask 개수'.padEnd(25) + 
          (pdfHigh.longTasks.avg.toFixed(1) + '개').padEnd(18) + 
          (queueHigh.longTasks.avg.toFixed(1) + '개').padEnd(18) + 
          (ltHigh > 0 ? '✅ -' : ltHigh < 0 ? '❌ +' : '➖ ') + Math.abs(ltHigh).toFixed(1) + '%');
        
        console.log('sendWithPromise 호출'.padEnd(25) + 
          (pdfHigh.sendWithPromise.avg.toFixed(1) + '회').padEnd(18) + 
          (queueHigh.sendWithPromise.avg.toFixed(1) + '회').padEnd(18) + 
          (sendHigh > 0 ? '✅ -' : sendHigh < 0 ? '❌ +' : '➖ ') + Math.abs(sendHigh).toFixed(1) + '%');
        
        console.log('\\n💡 결론:');
        if (tbtBasic > 0 && tbtHigh < 0) {
          console.log('   ✅ Queue 방식은 저사양 환경에서 효과적입니다 (TBT ' + tbtBasic.toFixed(1) + '% 개선)');
          console.log('   ❌ 고사양 환경에서는 오히려 성능이 나빠집니다 (TBT ' + Math.abs(tbtHigh).toFixed(1) + '% 악화)');
          console.log('   → 저사양 환경에 최적화된 방식입니다.');
        } else if (tbtBasic > 0 && tbtHigh > 0) {
          console.log('   ✅ Queue 방식은 모든 환경에서 효과적입니다!');
        } else {
          console.log('   Queue 방식의 효과가 명확하지 않습니다.');
        }
      }
    }
  "
else
  echo "⚠️  결과 파일을 찾을 수 없습니다: ${RESULT_FILE}"
fi

echo ""
echo "결과 파일: ${RESULT_FILE}"
echo ""

