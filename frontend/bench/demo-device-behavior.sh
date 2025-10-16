#!/bin/bash
# 데모용 빠른 기기 × 행동 패턴 벤치마크
# 실제 측정보다는 결과 형식과 분석 방법을 보여주기 위한 스크립트

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 데모: 기기별 성능 벤치마크${NC}"
echo ""
echo "이 데모는 매우 빠르게 실행되어 결과 형식을 확인할 수 있습니다."
echo "실제 측정을 위해서는 './run-device-behavior-test.sh quick' 을 사용하세요."
echo ""

# 기본 URL
PDF_URL="http://localhost:3000/feedback/4?version=pdf"
QUEUE_URL="http://localhost:3000/feedback/4?version=queue"

# 스크립트 디렉토리
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 데모 모드: 저사양 기기 1개 (2회 테스트)
echo -e "${GREEN}⚡ 초고속 데모 실행 중...${NC}"
echo "   - 기기: 🐌 저사양"
echo "   - 행동: 🎯 현실적 패턴 (스크롤 → 읽기 → 반복)"
echo "   - 총 테스트: 2회 (PDF 1회 + Queue 1회)"
echo "   - 예상 소요 시간: 약 3-4분"
echo ""

node "$SCRIPT_DIR/bench-device-behavior.js" \
  --url1 "$PDF_URL" --name1 "PDF" \
  --url2 "$QUEUE_URL" --name2 "Queue" \
  --devices "low" \
  --headless true

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo -e "${GREEN}✅ 데모 완료!${NC}"
  echo ""
  echo "📊 결과 해석:"
  echo "   - TBT (Total Blocking Time): 낮을수록 좋음"
  echo "   - LongTask 수: 적을수록 좋음"
  echo "   - 렌더링 효율: 높을수록 좋음"
  echo ""
  echo "🔍 다음 단계:"
  echo "   1. 더 많은 조합 테스트: ./run-device-behavior-test.sh quick"
  echo "   2. 전체 매트릭스 테스트: ./run-device-behavior-test.sh full"
  echo "   3. 특정 기기만 테스트: ./run-device-behavior-test.sh low-device"
  echo ""
else
  echo ""
  echo -e "${YELLOW}⚠️  데모 실행 중 오류 발생${NC}"
  echo "서버가 http://localhost:3000 에서 실행 중인지 확인하세요."
  echo ""
fi

