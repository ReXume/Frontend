#!/bin/bash

# PDF 렌더링 성능 비교 벤치마크 실행 스크립트

echo "🚀 PDF vs 우선순위 큐 렌더링 성능 비교"
echo ""

RUNS=${1:-3}

echo "📊 설정:"
echo "  - 실행 횟수: ${RUNS}회"
echo "  - CPU 쓰로틀링: 4x"
echo "  - 대기 시간: 8초"
echo ""
echo "⏳ 벤치마크 시작..."
echo ""

cd "$(dirname "$0")/.."
node bench/pdf-render-benchmark.js $RUNS

