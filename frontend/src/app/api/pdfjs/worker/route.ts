import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";

// 로컬 node_modules에서 워커 파일을 읽어 동일 출처로 서빙
export async function GET() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "node_modules/pdfjs-dist/build/pdf.worker.min.js"),
    path.join(cwd, "node_modules/pdfjs-dist/build/pdf.worker.js"),
    path.join(cwd, "public/pdf.worker.min.js"),
  ];

  for (const filePath of candidates) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (e: unknown) {
      console.error(`Failed to read ${filePath}:`, e);
    }
  }

  return NextResponse.json({ message: "pdf.js worker not found locally" }, { status: 404 });
}


