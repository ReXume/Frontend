#!/bin/bash
# 모든 벤치마크 테스트를 순차적으로 실행합니다
# 
# 사용법:
#   ./run-all-tests.sh           # 기본 설정으로 실행
#   ./run-all-tests.sh quick     # 빠른 테스트 (각 1회)
#   ./run-all-tests.sh full      # 전체 테스트 (각 5회)

MODE=${1:-default}

echo "════════════════════════════════════════════════════════════════"
echo "🚀 PDF 렌더링 성능 벤치마크 전체 테스트"
echo "════════════════════════════════════════════════════════════════"
echo ""

# 모드별 설정
case $MODE in
  quick)
    WEB_VITALS_RUNS=1
    WEB_VITALS_PRESET="fast"
    RENDERING_RUNS=1
    REAL_USER_RUNS=1
    echo "⚡ 빠른 테스트 모드"
    ;;
  full)
    WEB_VITALS_RUNS=5
    WEB_VITALS_PRESET="realistic"
    RENDERING_RUNS=5
    REAL_USER_RUNS=5
    echo "🔥 전체 테스트 모드"
    ;;
  *)
    WEB_VITALS_RUNS=3
    WEB_VITALS_PRESET="realistic"
    RENDERING_RUNS=3
    REAL_USER_RUNS=3
    echo "📊 기본 테스트 모드"
    ;;
esac

echo "   Web Vitals: ${WEB_VITALS_RUNS}회, ${WEB_VITALS_PRESET} 프리셋"
echo "   Rendering: ${RENDERING_RUNS}회"
echo "   Real User: ${REAL_USER_RUNS}회 (CPU 4x)"
echo ""
echo "────────────────────────────────────────────────────────────────"

# 시작 시간 기록
START_TIME=$(date +%s)

# 1. 웹 바이탈 테스트
echo ""
echo "1️⃣  웹 바이탈 테스트 시작..."
echo "────────────────────────────────────────────────────────────────"
cd web-vitals
./run-test.sh ${WEB_VITALS_RUNS} ${WEB_VITALS_PRESET}
WEB_VITALS_STATUS=$?
cd ..

if [ $WEB_VITALS_STATUS -eq 0 ]; then
  echo "✅ 웹 바이탈 테스트 완료"
else
  echo "❌ 웹 바이탈 테스트 실패 (종료 코드: $WEB_VITALS_STATUS)"
fi

# 2. 렌더링 시나리오 테스트
echo ""
echo "2️⃣  렌더링 시나리오 테스트 시작..."
echo "────────────────────────────────────────────────────────────────"
cd rendering-scenarios
./run-test.sh ${RENDERING_RUNS}
RENDERING_STATUS=$?
cd ..

if [ $RENDERING_STATUS -eq 0 ]; then
  echo "✅ 렌더링 시나리오 테스트 완료"
else
  echo "❌ 렌더링 시나리오 테스트 실패 (종료 코드: $RENDERING_STATUS)"
fi

# 3. 실사용자 패턴 테스트
echo ""
echo "3️⃣  실사용자 패턴 테스트 시작..."
echo "────────────────────────────────────────────────────────────────"
cd real-user-pattern
./run-test.sh ${REAL_USER_RUNS}
REAL_USER_STATUS=$?
cd ..

if [ $REAL_USER_STATUS -eq 0 ]; then
  echo "✅ 실사용자 패턴 테스트 완료"
else
  echo "❌ 실사용자 패턴 테스트 실패 (종료 코드: $REAL_USER_STATUS)"
fi

# 종료 시간 및 총 소요 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# 최종 결과 요약
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 전체 테스트 결과 요약"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "1. 웹 바이탈 테스트:     $([ $WEB_VITALS_STATUS -eq 0 ] && echo '✅ 성공' || echo '❌ 실패')"
echo "2. 렌더링 시나리오 테스트: $([ $RENDERING_STATUS -eq 0 ] && echo '✅ 성공' || echo '❌ 실패')"
echo "3. 실사용자 패턴 테스트:   $([ $REAL_USER_STATUS -eq 0 ] && echo '✅ 성공' || echo '❌ 실패')"
echo ""
echo "⏱️  총 소요 시간: ${MINUTES}분 ${SECONDS}초"
echo ""
echo "📁 결과 파일 위치:"
echo "   - Web Vitals:      ./web-vitals/results/"
echo "   - Rendering:       ./rendering-scenarios/results/"
echo "   - Real User:       ./real-user-pattern/results/"
echo ""

# 전체 상태 코드 반환
if [ $WEB_VITALS_STATUS -eq 0 ] && [ $RENDERING_STATUS -eq 0 ] && [ $REAL_USER_STATUS -eq 0 ]; then
  echo "🎉 모든 테스트가 성공적으로 완료되었습니다!"
  exit 0
else
  echo "⚠️  일부 테스트가 실패했습니다. 로그를 확인해주세요."
  exit 1
fi

