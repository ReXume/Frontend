"use client";

import { useEffect, useState } from "react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist/build/pdf"; 

import PDF from "./PDF";
import { FeedbackPoint } from "@/types/FeedbackPointType";
import { AddFeedbackPoint } from "@/types/AddFeedbackPointType";

// 워커 파일 경로를 CDN으로 설정 (안정적인 방법)
if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

interface PDFViewerProps {
  pdfSrc: string;
  pageNumber: number;
  addFeedbackPoint: (point: Omit<AddFeedbackPoint, "id">) => void;
  editFeedbackPoint: (point: FeedbackPoint) => void;
  feedbackPoints: FeedbackPoint[];
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
  setClickedCommentId: (id: number | null) => void;
}

const PDFViewer = ({
  pdfSrc,
  // pageNumber,
  addFeedbackPoint,
  // editFeedbackPoint,
  feedbackPoints,
  hoveredCommentId,
  setHoveredCommentId,
  setClickedCommentId,
}: PDFViewerProps) => {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      if (!pdfSrc || typeof pdfSrc !== "string" || !pdfSrc.trim()) {
        setErr("PDF URL이 비어있습니다.");
        return;
      }
      
      try {
        // 워커 상태 확인 및 재설정
        if (typeof window !== 'undefined') {
          GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
        
        const task = getDocument({ 
          url: pdfSrc,
          // 워커 관련 설정 추가
          worker: undefined, // 기본 워커 사용
        });
        const loaded = await task.promise;
        if (cancelled) return;
        setPdf(loaded);
        setNumPages(loaded.numPages);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        console.error("Failed to load PDF:", e);
        setErr(`PDF 로딩에 실패했습니다: ${e.message || '알 수 없는 오류'}`);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfSrc]);


  if (err) return <div>{err}</div>;
  if (!pdf) return <div>PDF 로딩 중...</div>;


  return (
    <div
      style={{
        width: 1200,
        margin: "auto",
        overflowY: "auto",
        maxHeight: "90vh",
      }}
    >
      {Array.from({ length: numPages }).map((_, idx) => (
        <PDF
          key={`page-${idx + 1}`}
          pdf={pdf}
          pageNumber={idx + 1}
          feedback={[]}
          addFeedbackPoint={addFeedbackPoint}
          feedbackPoints={feedbackPoints}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          setClickedCommentId={setClickedCommentId}
        />
      ))}
    </div>  
  );
};

export default PDFViewer;
