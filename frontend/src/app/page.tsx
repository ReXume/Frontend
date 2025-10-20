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
            href="/feedback/4?version=simple"
            className="block w-full px-4 py-3 rounded-lg bg-purple-50 border-2 border-purple-200 shadow hover:shadow-md transition text-center text-gray-900"
          >
            🎯 PDF Simple 버전 (단순 IntersectionObserver)
          </Link>
          <Link
            href="/feedback/4?version=queue"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            ⚡ PDF Queue 버전 (RenderScheduler)
          </Link>
          <Link
            href="/feedback/4?version=raf"
            className="block w-full px-4 py-3 rounded-lg bg-orange-50 border-2 border-orange-200 shadow hover:shadow-md transition text-center text-gray-900"
          >
            🎬 PDF rAF 버전 (requestAnimationFrame)
          </Link>
          <Link
            href="/feedback/4?version=lazy"
            className="block w-full px-4 py-3 rounded-lg bg-yellow-50 border-2 border-yellow-200 shadow hover:shadow-md transition text-center text-gray-900"
          >
            🐌 PDF Lazy 버전 (지연된 getPage)
          </Link>
          <Link
            href="/feedback-raf/4"
            className="block w-full px-4 py-3 rounded-lg bg-orange-100 border-2 border-orange-300 shadow hover:shadow-md transition text-center text-gray-900"
          >
            🎬 rAF 전용 페이지 (독립 테스트)
          </Link>
          <div className="my-4 border-t border-gray-300"></div>
        </div>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">버전 차이점:</h2>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• <strong>기본 버전:</strong> 개선 전 기본 PDF 뷰어 (성능 최적화 없음)</li>
            <li>• <strong>일반 버전:</strong> 뷰포트에 보이면 즉시 렌더링, 재시도 로직 포함</li>
            <li>• <strong>Simple 버전:</strong> 스케줄러 없이 단순한 IntersectionObserver만 사용</li>
            <li>• <strong>Queue 버전:</strong> 렌더링 큐 관리, 우선순위 기반, Backpressure 기법</li>
            <li>• <strong>rAF 버전:</strong> requestAnimationFrame을 사용한 렌더링 최적화</li>
            <li>• <strong>Lazy 버전:</strong> 페이지 크기 미리 계산 제거, 관찰 후에만 getPage() 호출</li>
          </ul>
        </div>
      </div>
    </div>
  );
}