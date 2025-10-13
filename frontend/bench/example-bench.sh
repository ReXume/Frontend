#!/bin/bash

# Web Vitals 벤치마크 예제 스크립트
# 사용법: ./bench/example-bench.sh

echo "🚀 Web Vitals 벤치마크 예제"
echo "======================================"
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

# 예제 1: 단일 URL 빠른 테스트
echo "📊 예제 1: 단일 URL 빠른 테스트"
echo "--------------------------------------"
npm run bench:webvitals -- --url "http://localhost:3000" --wait 2000

echo ""
echo "========================================"
echo ""

# 예제 2: 여러 URL 비교 (옵션)
read -p "여러 URL을 비교하시겠습니까? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📊 예제 2: 여러 URL 비교"
    echo "--------------------------------------"
    npm run bench:webvitals -- \
      --url1 "http://localhost:3000" --name1 "Home" \
      --url2 "http://localhost:3000/feedback/4" --name2 "Feedback" \
      --runs 2
fi

echo ""
echo "✅ 벤치마크 완료!"
echo "📁 결과는 bench/bench_out/ 폴더에 저장되었습니다."

