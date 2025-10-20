#!/bin/bash

# LongTask 이벤트 분석 벤치마크 실행 스크립트
# 
# 사용법:
#   ./run-test.sh                           # 기본 실행 (PDF vs Queue 비교)
#   ./run-test.sh 3                         # 3회 실행
#   ./run-test.sh 5 pdf                     # PDF 버전만 5회 실행
#   ./run-test.sh 3 queue                   # Queue 버전만 3회 실행
#   ./run-test.sh 1 all                     # 3개 버전 모두 비교 (Base, PDF, Queue)

set -e

# 기본 설정
RUNS=${1:-1}
VERSION=${2:-"both"}
CPU_THROTTLE=4
STEPS=5
DELAY=600
SCROLL_RANGE=0.2
HEADLESS=false

# 스크립트 디렉토리 찾기
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
BENCH_SCRIPT="$SCRIPT_DIR/bench-longtask-analytics.js"

# 서버가 실행 중인지 확인
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ 개발 서버가 실행되지 않았습니다."
    echo "   npm run dev로 서버를 시작한 후 다시 실행하세요."
    exit 1
fi

echo "🚀 LongTask 이벤트 분석 벤치마크 시작"
echo "   실행 횟수: ${RUNS}회"
echo "   테스트 버전: ${VERSION}"
echo "   CPU 스로틀: ${CPU_THROTTLE}x"
echo "   스크롤 단계: ${STEPS}단계, ${DELAY}ms 간격"
echo "   스크롤 범위: 20%"
echo "   헤드리스: ${HEADLESS}"
echo ""

cd "$SCRIPT_DIR"

if [ "$VERSION" = "both" ] || [ "$VERSION" = "all" ] || [ "$VERSION" = "base" ]; then
    echo "📊 Base 버전 분석 시작..."
    
    for i in $(seq 1 $RUNS); do
        echo ""
        echo "--- 실행 $i/$RUNS ---"
        node "$BENCH_SCRIPT" \
            --url "http://localhost:3000/feedback-basic/4" \
            --name1 "Base" \
            --cpu $CPU_THROTTLE \
            --steps $STEPS \
            --delay $DELAY \
            --range $SCROLL_RANGE \
            --headless $HEADLESS
    done
fi

if [ "$VERSION" = "both" ] || [ "$VERSION" = "all" ] || [ "$VERSION" = "pdf" ]; then
    echo "📊 PDF 버전 분석 시작..."
    
    for i in $(seq 1 $RUNS); do
        echo ""
        echo "--- 실행 $i/$RUNS ---"
        node "$BENCH_SCRIPT" \
            --url "http://localhost:3000/feedback/4?version=pdf" \
            --name1 "PDF" \
            --cpu $CPU_THROTTLE \
            --steps $STEPS \
            --delay $DELAY \
            --range $SCROLL_RANGE \
            --headless $HEADLESS
    done
fi

if [ "$VERSION" = "both" ] || [ "$VERSION" = "all" ] || [ "$VERSION" = "queue" ]; then
    echo "📊 Queue 버전 분석 시작..."
    
    for i in $(seq 1 $RUNS); do
        echo ""
        echo "--- 실행 $i/$RUNS ---"
        node "$BENCH_SCRIPT" \
            --url "http://localhost:3000/feedback/4?version=queue" \
            --name1 "Queue" \
            --cpu $CPU_THROTTLE \
            --steps $STEPS \
            --delay $DELAY \
            --range $SCROLL_RANGE \
            --headless $HEADLESS
    done
fi

if [ "$VERSION" = "both" ] && [ "$RUNS" -eq 1 ]; then
    echo ""
    echo "📊 PDF vs Queue 비교 분석 실행..."
    node "$BENCH_SCRIPT" \
        --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF" \
        --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue" \
        --cpu $CPU_THROTTLE \
        --steps $STEPS \
        --delay $DELAY \
        --range $SCROLL_RANGE \
        --headless $HEADLESS
elif [ "$VERSION" = "all" ] && [ "$RUNS" -eq 1 ]; then
    echo ""
    echo "📊 3개 버전 전체 비교 분석 실행..."
    node "$BENCH_SCRIPT" \
        --url1 "http://localhost:3000/feedback-basic/4" --name1 "Base" \
        --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF" \
        --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue" \
        --cpu $CPU_THROTTLE \
        --steps $STEPS \
        --delay $DELAY \
        --range $SCROLL_RANGE \
        --headless $HEADLESS
fi

echo ""
echo "✅ LongTask 분석 완료!"
echo "   결과 파일은 results/ 디렉토리에서 확인할 수 있습니다."
