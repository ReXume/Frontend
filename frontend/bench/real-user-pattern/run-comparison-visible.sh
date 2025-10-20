#!/bin/bash
# PDF 버전 비교 테스트 (가시적 모드)
# 
# PDF Simple vs 다른 버전을 브라우저 창에서 비교 테스트:
# - 두 개의 브라우저 창이 열려서 비교 가능
# - 성능 측정 및 LongTask 추적
# - 실사용자 패턴 시뮬레이션

echo "🚀 PDF 버전 비교 가시적 테스트 시작"
echo "=================================="
echo ""

# 실행 횟수 (기본값: 1회)
RUNS=${1:-1}

# CPU throttle (기본값: 4x)
CPU=${2:-4}

# 비교할 버전 (기본값: pdf)
COMPARE_VERSION=${3:-pdf}

echo "⚙️  설정:"
echo "   - 실행 횟수: ${RUNS}회"
echo "   - CPU Throttle: ${CPU}x"
echo "   - 브라우저: 가시적 모드 (headless=false)"
echo "   - 비교 버전: Simple vs ${COMPARE_VERSION}"
echo "   - 패턴: 현실적 사용자 스크롤 패턴 (빠른 스크롤)"
echo "   - 스크롤 지연: 350ms (빠른 속도)"
echo ""

# 현재 스크립트 디렉토리로 이동
cd "$(dirname "$0")"

# 여러 번 실행
for i in $(seq 1 ${RUNS}); do
  echo ""
  echo "────────────────────────────────────────────────────────────────"
  echo "🔄 실행 ${i}/${RUNS} - 두 개의 브라우저 창이 열립니다"
  echo "────────────────────────────────────────────────────────────────"
  echo "   🎯 Simple 버전 vs 📄 ${COMPARE_VERSION} 버전"
  
  # Simple vs 다른 버전 비교 테스트 (가시적 모드)
  node bench-pdfjs-longtasks.js \
    --url1 "http://localhost:3000/feedback/4?version=simple" --name1 "PDF-Simple" \
    --url2 "http://localhost:3000/feedback/4?version=${COMPARE_VERSION}" --name2 "PDF-${COMPARE_VERSION}" \
    --cpu ${CPU} \
    --headless false \
    --realistic true \
    --steps 15 \
    --delay 350
  
  if [ $? -ne 0 ]; then
    echo "❌ 실행 ${i} 실패"
  else
    echo "✅ 실행 ${i} 완료"
  fi
  
  # 마지막 실행이 아니면 잠깐 대기
  if [ $i -lt ${RUNS} ]; then
    echo "⏱️  다음 실행까지 5초 대기..."
    sleep 5
  fi
done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ PDF 버전 비교 가시적 테스트 완료!"
echo "📁 결과 파일: ./results/"
echo "💡 브라우저 개발자 도구에서 Performance 탭도 확인하세요"
echo ""
echo "사용법 예시:"
echo "  ./run-comparison-visible.sh 1 4 pdf    # Simple vs PDF (기본)"
echo "  ./run-comparison-visible.sh 1 4 queue  # Simple vs Queue"
echo "════════════════════════════════════════════════════════════════"
