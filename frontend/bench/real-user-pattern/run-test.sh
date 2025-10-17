#!/bin/bash
# 실사용자 패턴 테스트 실행 스크립트
# 
# 실제 사용자 행동 패턴을 시뮬레이션합니다:
# - 빠르게 스크롤해서 내용 훑어보기
# - 관심 있는 부분에서 정지하여 읽기
# - 이전 내용 확인을 위해 위로 스크롤하기
# 
# PDF vs Queue 버전을 비교합니다.

echo "🚀 실사용자 패턴 테스트 시작"
echo "================================"
echo ""

# 실행 횟수 (기본값: 3회)
RUNS=${1:-3}

# CPU throttle 고정값
CPU=4

echo "⚙️  설정:"
echo "   - 실행 횟수: ${RUNS}회"
echo "   - CPU Throttle: ${CPU}x"
echo "   - 패턴: 스크롤 → 읽기 → 반복"
echo "   - 비교 버전: PDF vs Queue"
echo ""

# 현재 스크립트 디렉토리로 이동
cd "$(dirname "$0")"

# 여러 번 실행
for i in $(seq 1 ${RUNS}); do
  echo ""
  echo "────────────────────────────────────────────────────────────────"
  echo "🔄 실행 ${i}/${RUNS}"
  echo "────────────────────────────────────────────────────────────────"
  
  node bench-pdfjs-longtasks.js \
    --url1 "http://localhost:3000/feedback/4?version=pdf" --name1 "PDF-4x" \
    --url2 "http://localhost:3000/feedback/4?version=queue" --name2 "Queue-4x" \
    --cpu ${CPU} \
    --realistic true
  
  if [ $? -ne 0 ]; then
    echo "❌ 실행 ${i} 실패"
  else
    echo "✅ 실행 ${i} 완료"
  fi
  
  # 마지막 실행이 아니면 잠깐 대기
  if [ $i -lt ${RUNS} ]; then
    echo "⏱️  다음 실행까지 3초 대기..."
    sleep 3
  fi
done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ 실사용자 패턴 테스트 전체 완료!"
echo "📁 결과 파일: ./results/"
echo "════════════════════════════════════════════════════════════════"

