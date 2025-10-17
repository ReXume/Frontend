#!/bin/bash
# 기기 × 행동 패턴 벤치마크 실행 스크립트

# 색상 코드
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 기기 × 행동 패턴 벤치마크${NC}"
echo ""

# 기본 URL
PDF_URL="http://localhost:3000/feedback/4?version=pdf"
QUEUE_URL="http://localhost:3000/feedback/4?version=queue"

# 옵션 확인
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "사용법:"
  echo "  $0 [옵션]"
  echo ""
  echo "🎯 행동 패턴: 현실적 패턴 (스크롤 → 읽기 → 반복) 고정"
  echo ""
  echo "옵션:"
  echo "  full              - 전체 기기 테스트 (3 기기 × 2 버전 = 6회, ~10분)"
  echo "  quick             - 빠른 테스트 (저사양 + 고사양, 2 × 2 = 4회, ~7분)"
  echo "  low-device        - 저사양 기기만 (2회, ~3분)"
  echo "  mid-device        - 중사양 기기만 (2회, ~3분)"
  echo "  high-device       - 고사양 기기만 (2회, ~3분)"
  echo "  compare-versions  - PDF vs Queue 비교 (전체 기기)"
  echo ""
  exit 0
fi

# 테스트 모드 선택
MODE=${1:-full}

# 스크립트 디렉토리 (bench/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

case $MODE in
  full)
    echo -e "${GREEN}📊 전체 매트릭스 테스트 (3 기기 × 1 행동 × 2 버전 = 6회)${NC}"
    echo -e "   행동 패턴: 🎯 현실적 패턴 (스크롤 → 읽기 → 반복)"
    node "$SCRIPT_DIR/bench-device-behavior.js" \
      --url1 "$PDF_URL" --name1 "PDF" \
      --url2 "$QUEUE_URL" --name2 "Queue"
    ;;
    
  quick)
    echo -e "${GREEN}⚡ 빠른 테스트 (2 기기 × 1 행동 × 2 버전 = 4회)${NC}"
    echo -e "   기기: 저사양, 고사양"
    echo -e "   행동: 🎯 현실적 패턴"
    node "$SCRIPT_DIR/bench-device-behavior.js" \
      --url1 "$PDF_URL" --name1 "PDF" \
      --url2 "$QUEUE_URL" --name2 "Queue" \
      --devices "low,high"
    ;;
    
  low-device)
    echo -e "${YELLOW}🐌 저사양 기기 테스트 (1 기기 × 1 행동 × 2 버전 = 2회)${NC}"
    node "$SCRIPT_DIR/bench-device-behavior.js" \
      --url1 "$PDF_URL" --name1 "PDF" \
      --url2 "$QUEUE_URL" --name2 "Queue" \
      --devices "low"
    ;;
    
  mid-device)
    echo -e "${BLUE}🚗 중사양 기기 테스트 (1 기기 × 1 행동 × 2 버전 = 2회)${NC}"
    node "$SCRIPT_DIR/bench-device-behavior.js" \
      --url1 "$PDF_URL" --name1 "PDF" \
      --url2 "$QUEUE_URL" --name2 "Queue" \
      --devices "mid"
    ;;
    
  high-device)
    echo -e "${GREEN}🚀 고사양 기기 테스트 (1 기기 × 1 행동 × 2 버전 = 2회)${NC}"
    node "$SCRIPT_DIR/bench-device-behavior.js" \
      --url1 "$PDF_URL" --name1 "PDF" \
      --url2 "$QUEUE_URL" --name2 "Queue" \
      --devices "high"
    ;;
    
  compare-versions)
    echo -e "${GREEN}🔍 버전 비교 (PDF vs Queue)${NC}"
    node "$SCRIPT_DIR/bench-device-behavior.js" \
      --url1 "$PDF_URL" --name1 "PDF" \
      --url2 "$QUEUE_URL" --name2 "Queue"
    ;;
    
  *)
    echo -e "${YELLOW}⚠️  알 수 없는 모드: $MODE${NC}"
    echo "사용 가능한 모드: full, quick, low-device, mid-device, high-device, compare-versions"
    echo "'$0 --help'로 도움말을 확인하세요."
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✅ 벤치마크 완료!${NC}"
echo "결과는 bench/bench_out/ 폴더에 저장되었습니다."

