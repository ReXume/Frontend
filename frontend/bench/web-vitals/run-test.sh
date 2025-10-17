#!/bin/bash
# 웹 바이탈 테스트 실행 스크립트
# 
# 3가지 버전을 비교합니다:
# 1. feedback-basic (기본 버전)
# 2. feedback?version=pdf (PDF 버전)
# 3. feedback?version=queue (Queue 우선순위 버전)

echo "🚀 웹 바이탈 테스트 시작"
echo "================================"
echo ""

# 실행 횟수 (기본값: 3회)
RUNS=${1:-3}

# 프리셋 (기본값: realistic)
PRESET=${2:-realistic}

echo "⚙️  설정:"
echo "   - 실행 횟수: ${RUNS}회"
echo "   - 프리셋: ${PRESET}"
echo ""

# 현재 스크립트 디렉토리로 이동
cd "$(dirname "$0")"

# 테스트 실행
node bench-webvitals.js \
  --url1 "http://localhost:3000/feedback-basic/4" --name1 "Basic" \
  --url2 "http://localhost:3000/feedback/4?version=pdf" --name2 "PDF" \
  --url3 "http://localhost:3000/feedback/4?version=queue" --name3 "Queue" \
  --runs ${RUNS} \
  --preset ${PRESET}

echo ""
echo "✅ 웹 바이탈 테스트 완료!"
echo "📁 결과 파일: ./results/"

