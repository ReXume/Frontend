#!/bin/bash

echo "🚀 PDF 고급 성능 벤치마크"
echo ""
echo "📊 측정 지표:"
echo "  ✅ 렌더링 효율성 (pages/sec)"
echo "  ✅ 페이지당 평균 렌더링 시간"
echo "  ✅ 프레임 드롭 카운트"
echo "  ✅ 인터랙션 응답 시간"
echo "  ✅ 렌더링 순서 분석"
echo "  ✅ Long Tasks & TBT"
echo ""

RUNS=${1:-10}

echo "⏳ 실행 횟수: ${RUNS}회"
echo "⏳ 예상 시간: 약 $(($RUNS * 2))분"
echo ""

cd "$(dirname "$0")/.."
node bench/pdf-advanced-benchmark.js $RUNS

