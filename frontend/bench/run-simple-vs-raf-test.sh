#!/bin/bash

# Simple vs RAF 성능 비교 테스트 실행 스크립트

echo "🚀 Simple vs RAF 성능 비교 테스트 시작"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 현재 디렉토리 확인
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Node.js가 설치되어 있는지 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    exit 1
fi

# 서버가 실행 중인지 확인
echo "🔍 서버 상태 확인 중..."
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ 서버가 실행되지 않았습니다. http://localhost:3000 에서 서버를 시작해주세요."
    exit 1
fi

echo "✅ 서버 정상 작동 확인됨"

# 벤치마크 실행
echo "📊 성능 테스트 시작..."
node bench-simple-vs-raf-performance.js

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 테스트 완료!"
echo "📁 결과는 bench/results/ 폴더에서 확인할 수 있습니다."
