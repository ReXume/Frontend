// src/components/pdf/PDFViewer.tsx
"use client";

import dynamic from "next/dynamic";

// Core를 바로 import해도 되지만, 큰 번들이면 지연 로딩 권장
const PDFCoreClient = dynamic(() => import("./PDFCoreClient"), { ssr: false });

type Props = {
  url: string;
  scale?: number;
  className?: string;
};

export default function PDFViewer({ url, scale, className }: Props) {
  if (!url) {
    return <div className={className}>PDF URL이 비어있습니다.</div>;
  }
  return (
    <div className={className}>
      <PDFCoreClient url={url} scale={scale} />
    </div>
  );
}
