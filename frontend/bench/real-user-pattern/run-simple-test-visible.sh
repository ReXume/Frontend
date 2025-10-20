#!/bin/bash
# PDF Simple 버전 headless가 아닌 버전으로 테스트
# 
# PDF Simple 버전을 실제 브라우저 창에서 테스트하여:
# - 테스트 과정을 직접 볼 수 있음
# - 성능 측정 및 LongTask 추적
# - 실사용자 패턴 시뮬레이션

echo "🚀 PDF Simple 버전 가시적 테스트 시작"
echo "====================================="
echo ""

# 실행 횟수 (기본값: 1회 - 시각적 확인용)
RUNS=${1:-1}

# CPU throttle (기본값: 4x)
CPU=${2:-4}

echo "⚙️  설정:"
echo "   - 실행 횟수: ${RUNS}회"
echo "   - CPU Throttle: ${CPU}x"
echo "   - 브라우저: 가시적 모드 (headless=false)"
echo "   - 테스트 버전: PDF Simple"
echo "   - 패턴: 현실적 사용자 스크롤 패턴 (빠른 스크롤)"
echo "   - 스크롤 지연: 300ms (빠른 속도)"
echo ""

# 현재 스크립트 디렉토리로 이동
cd "$(dirname "$0")"

# 여러 번 실행
for i in $(seq 1 ${RUNS}); do
  echo ""
  echo "────────────────────────────────────────────────────────────────"
  echo "🔄 실행 ${i}/${RUNS} - 브라우저 창이 열립니다"
  echo "────────────────────────────────────────────────────────────────"
  
  # Simple 버전만 테스트 (가시적 모드)
  node bench-pdfjs-longtasks.js \
    --url "http://localhost:3000/feedback/4?version=simple" \
    --name "PDF-Simple-Visible" \
    --cpu ${CPU} \
    --headless false \
    --realistic true \
    --steps 18 \
    --delay 300
  
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
echo "✅ PDF Simple 가시적 테스트 완료!"
echo "📁 결과 파일: ./results/"
echo "💡 브라우저 개발자 도구에서 Performance 탭도 확인하세요"
echo "════════════════════════════════════════════════════════════════"
