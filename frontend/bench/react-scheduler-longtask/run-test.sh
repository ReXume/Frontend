#!/bin/bash

# React Scheduler LongTask 분석 테스트 스크립트
# Chrome Performance 플레임차트에서 관측된 React 렌더링 루프 LongTask 패턴 분석

set -e

echo "⚛️ React Scheduler LongTask 분석 테스트 시작"
echo "=============================================="

# 결과 디렉토리 확인
RESULTS_DIR="results"
if [ ! -d "$RESULTS_DIR" ]; then
    mkdir -p "$RESULTS_DIR"
fi

# 기본 설정
CPU_THROTTLE=4
HEADLESS=true
SCROLL_STEPS=12
STEP_DELAY=1000

# 파라미터 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        --cpu)
            CPU_THROTTLE="$2"
            shift 2
            ;;
        --visible)
            HEADLESS=false
            shift
            ;;
        --steps)
            SCROLL_STEPS="$2"
            shift 2
            ;;
        --delay)
            STEP_DELAY="$2"
            shift 2
            ;;
        --url)
            SINGLE_URL="$2"
            shift 2
            ;;
        --url1)
            URL1="$2"
            shift 2
            ;;
        --url2)
            URL2="$2"
            shift 2
            ;;
        --name1)
            NAME1="$2"
            shift 2
            ;;
        --name2)
            NAME2="$2"
            shift 2
            ;;
        *)
            echo "알 수 없는 파라미터: $1"
            exit 1
            ;;
    esac
done

echo "설정:"
echo "  CPU Throttle: ${CPU_THROTTLE}x"
echo "  Headless: ${HEADLESS}"
echo "  스크롤 단계: ${SCROLL_STEPS}단계, ${STEP_DELAY}ms 간격"

# 기본 URL 설정 (없으면 에러)
if [ -z "$SINGLE_URL" ] && [ -z "$URL1" ]; then
    echo "❌ URL을 지정해주세요"
    echo ""
    echo "사용 예:"
    echo "  ./run-test.sh --url \"http://localhost:3000/feedback/4\""
    echo "  ./run-test.sh --url1 \"http://localhost:3000/feedback/4?version=pdf\" --name1 \"PDF\" --url2 \"http://localhost:3000/feedback/4?version=queue\" --name2 \"Queue\""
    exit 1
fi

# Node.js 스크립트 실행
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_SCRIPT="$SCRIPT_DIR/bench-react-scheduler-analysis.js"

echo ""
echo "🚀 React 스케줄러 분석 시작..."

if [ -n "$SINGLE_URL" ]; then
    # 단일 URL 테스트
    node "$NODE_SCRIPT" \
        --url "$SINGLE_URL" \
        --cpu "$CPU_THROTTLE" \
        --headless "$HEADLESS" \
        --steps "$SCROLL_STEPS" \
        --delay "$STEP_DELAY"
else
    # 비교 테스트
    ARGS="--cpu $CPU_THROTTLE --headless $HEADLESS --steps $SCROLL_STEPS --delay $STEP_DELAY"
    
    if [ -n "$URL1" ]; then
        ARGS="$ARGS --url1 \"$URL1\""
        if [ -n "$NAME1" ]; then
            ARGS="$ARGS --name1 \"$NAME1\""
        fi
    fi
    
    if [ -n "$URL2" ]; then
        ARGS="$ARGS --url2 \"$URL2\""
        if [ -n "$NAME2" ]; then
            ARGS="$ARGS --name2 \"$NAME2\""
        fi
    fi
    
    eval "node \"$NODE_SCRIPT\" $ARGS"
fi

echo ""
echo "✅ React 스케줄러 분석 완료!"
echo "결과는 results/ 디렉토리에서 확인할 수 있습니다."
