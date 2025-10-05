import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">데모 페이지 선택</h1>
        <div className="space-y-3">
          <Link
            href="/feedback/1"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            Sample 1 PDF 보기
          </Link>
          <Link
            href="/feedback/2"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            Sample 2 PDF 보기
          </Link>
          <Link
            href="/feedback/3"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            Sample 3 PDF 보기
          </Link>
          <Link
            href="/feedback/4"
            className="block w-full px-4 py-3 rounded-lg bg-white shadow hover:shadow-md transition text-center text-gray-900"
          >
            Sample 4 PDF 보기
          </Link>
        </div>
        <p className="text-xs text-gray-500 mt-4">각 링크는 해당하는 sample PDF를 표시합니다.</p>
      </div>
    </div>
  );
}