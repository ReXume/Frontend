#!/bin/bash

# 3가지 고정 버전 비교 스크립트
# 사용법: ./bench/bench-compare-versions.sh [runs]

RUNS=${1:-3}  # 기본 3회 실행

echo "🚀 ReXume 3가지 버전 성능 비교"
echo "======================================"
echo "📊 측정 횟수: ${RUNS}회"
echo ""

# 개발 서버 확인
echo "📡 개발 서버 확인 중..."
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "❌ 개발 서버가 실행되지 않았습니다."
    echo "   먼저 'npm run dev'를 실행해주세요."
    exit 1
fi

echo "✅ 개발 서버 실행 중"
echo ""

echo "📊 3가지 버전 비교 측정 시작..."
echo "  - PDF Version: /feedback/4?version=pdf"
echo "  - Basic Version: /feedback-basic/4"
echo "  - Queue Version: /feedback/4?version=queue"
echo ""

# Web Vitals 벤치마크 실행
node bench/bench-webvitals.js \
  --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF Version" \
  --url2 "http://localhost:3000/feedback-basic/4" --name2 "Basic Version" \
  --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue Version" \
  --runs ${RUNS} \
  --scroll true \
  --wait 3000

echo ""
echo "✅ 벤치마크 완료!"
echo "📁 결과는 bench/bench_out/ 폴더에 저장되었습니다."

