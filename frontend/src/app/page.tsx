import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">PDF 렌더링 버전 비교</h1>
        <div className="space-y-3">

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
        </div>
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">버전 차이점:</h2>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• <strong>일반 버전:</strong> 뷰포트에 보이면 즉시 렌더링, 재시도 로직 포함</li>
            <li>• <strong>Queue 버전:</strong> 렌더링 큐 관리, 우선순위 기반, Backpressure 기법</li>
          </ul>
        </div>
      </div>
    </div>
  );
}