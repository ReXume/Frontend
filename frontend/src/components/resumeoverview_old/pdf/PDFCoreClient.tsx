// src/components/pdf/PDFCoreClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument, type PDFPageProxy, type PDFDocumentProxy } from "pdfjs-dist";

// Worker 경로 설정 - Next.js에서 정적 파일로 제공
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

type Props = {
  url: string;
  scale?: number;
};

export default function PDFCoreClient({ url, scale = 1.25 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const task = getDocument(url);
      const pdf = await task.promise;
      if (cancelled) return;

      const page: PDFPageProxy = await pdf.getPage(1);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
    })().catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [url, scale]);

  return (
    <div className="p-4">
      <canvas ref={canvasRef} />
    </div>
  );
}
