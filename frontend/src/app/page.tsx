import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">데모 페이지 선택</h1>
        <div className="space-y-3">
          <Link
            href="/feedbackCRA/1"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            CSR (Client Side Rendering)
          </Link>
          <Link
            href="/feedbackSSR/1"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            SSR (Server Side Rendering)
          </Link>
          <Link
            href="/feedback/1"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            Streaming SSR
          </Link>
        </div>
        <p className="text-xs text-gray-500 mt-4">예시로 id 1로 연결됩니다.</p>
      </div>
    </div>
  );
}