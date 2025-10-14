#!/bin/bash

# bench-queue.sh — PDF vs Queue 비교 스크립트 실행기

echo "🚀 PDF vs 우선순위 큐 성능 비교 벤치마크"
echo ""
echo "사용법:"
echo "  ./bench-queue.sh                  # 기본 1회 실행"
echo "  ./bench-queue.sh 10               # 10회 실행"
echo "  ./bench-queue.sh 5 realistic      # 5회 실행 (realistic 프리셋)"
echo "  ./bench-queue.sh 3 intensive      # 3회 실행 (intensive 프리셋)"
echo ""

RUNS=${1:-1}
PRESET=${2:-""}

if [ -z "$PRESET" ]; then
  echo "📊 실행 설정: ${RUNS}회 (기본 설정)"
  node bench/bench-queue-comparison.js --runs $RUNS
else
  echo "📊 실행 설정: ${RUNS}회 (${PRESET} 프리셋)"
  node bench/bench-queue-comparison.js --runs $RUNS --preset $PRESET
fi

