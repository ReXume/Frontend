import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">PDF 렌더링 버전 비교</h1>
        <div className="space-y-3">

          <Link
            href="/feedback-basic/4"
            className="block w-full px-4 py-3 rounded-lg bg-blue-100 border-2 border-blue-300 shadow hover:shadow-md transition text-center text-gray-900"
          >
            📄 기본 PDF 버전 (개선 전)
          </Link>

          <Link
            href="/feedback/4?version=pdf"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            📄 일반 PDF 버전 (IntersectionObserver)
          </Link>
          <Link
            href="/feedback/4?version=queue"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            ⚡ PDF Queue 버전 (RenderScheduler)
          </Link>

          <div className="my-4 border-t border-gray-300"></div>

          <Link
            href="/feedback/4?version=fixed"
            className="block w-full px-4 py-3 rounded-lg bg-gray-100 border-2 border-gray-400 shadow hover:shadow-md transition text-center text-gray-900"
          >
            🔒 고정 K=5 스케줄러
          </Link>

          <Link
            href="/feedback/4?version=adaptive"
            className="block w-full px-4 py-3 rounded-lg bg-emerald-100 border-2 border-emerald-400 shadow hover:shadow-md transition text-center text-gray-900"
          >
            ⚡ 적응형 스케줄러 (Long Task 기반)
          </Link>

          <Link
            href="/compare-device-aware"
            className="block w-full px-4 py-3 rounded-lg bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-400 shadow hover:shadow-md transition text-center text-gray-900"
          >
            🎯 Device-Aware 스케줄러 (기기 감지 + IO 디바운스)
          </Link>
        </div>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">버전 차이점:</h2>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• <strong>기본 버전:</strong> 개선 전 기본 PDF 뷰어 (성능 최적화 없음)</li>
            <li>• <strong>일반 버전:</strong> 뷰포트에 보이면 즉시 렌더링, 재시도 로직 포함</li>
            <li>• <strong>Queue 버전:</strong> 렌더링 큐 관리, 우선순위 기반, Backpressure 기법</li>
            <li>• <strong>고정 K=5:</strong> 동시 렌더링 5개로 고정 (베이스라인)</li>
            <li>• <strong>적응형:</strong> Long Task 비율에 따라 K값 자동 조절 (1~6)</li>
            <li>• <strong>Device-Aware:</strong> 기기 성능 자동 감지 + 티어별 최적화 + IO 디바운스 (저성능 기기 특화)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}