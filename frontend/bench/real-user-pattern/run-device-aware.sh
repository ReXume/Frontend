#!/bin/bash

# Device-Aware 렌더 스케줄러 벤치마크 실행 스크립트

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Device-Aware 렌더 스케줄러 벤치마크                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Next.js 서버 확인
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "❌ 에러: Next.js 서버가 실행되지 않았습니다."
  echo "   다음 명령어로 서버를 먼저 시작하세요:"
  echo "   cd frontend && npm run dev"
  exit 1
fi

echo "✅ Next.js 서버 확인 완료"
echo ""

# 테스트 시나리오
echo "테스트 시나리오:"
echo "  1. 고성능 기기 시뮬레이션 (CPU 1x)"
echo "  2. 중성능 기기 시뮬레이션 (CPU 4x)"
echo "  3. 저성능 기기 시뮬레이션 (CPU 6x)"
echo ""

# 1. 고성능 기기
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  고성능 기기 (CPU 1x)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node ./bench-device-aware.js \
  --cpu 1 \
  --steps 10 \
  --delay 500 \
  --realistic true \
  --headless true

sleep 2

# 2. 중성능 기기
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  중성능 기기 (CPU 4x)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node ./bench-device-aware.js \
  --cpu 4 \
  --steps 10 \
  --delay 500 \
  --realistic true \
  --headless true

sleep 2

# 3. 저성능 기기
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  저성능 기기 (CPU 6x)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node ./bench-device-aware.js \
  --cpu 6 \
  --steps 10 \
  --delay 500 \
  --realistic true \
  --headless true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 모든 테스트 완료!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "결과 파일: ./results/"
echo ""
echo "다음 명령어로 결과를 확인하세요:"
echo "  ls -lht ./results/ | head -5"

