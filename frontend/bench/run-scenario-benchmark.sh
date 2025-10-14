#!/bin/bash

echo "🚀 PDF 시나리오 벤치마크"
echo ""
echo "시나리오 2: 점진적 스크롤 (10번)"
echo "시나리오 3: 점프 스크롤 (10번)"
echo ""
echo "⏳ 벤치마크 시작... (약 10-15분 소요)"
echo ""

cd "$(dirname "$0")/.."
node bench/pdf-scenario-benchmark.js

