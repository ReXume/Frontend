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

// 워커 초기화 상태 관리
let workerInitialized = false;
let workerInitPromise: Promise<void> | null = null;

// 워커 초기화 함수
const initializeWorker = async (): Promise<void> => {
  if (workerInitialized) return;
  if (workerInitPromise) return workerInitPromise;
  
  workerInitPromise = new Promise(async (resolve, reject) => {
    try {
      console.log('PDF 워커 초기화 시작');
      
      // CDN 워커 설정 (우선순위 1)
      GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      // 워커 로드를 위한 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('PDF 워커 초기화 완료');
      workerInitialized = true;
      resolve();
      
    } catch (error) {
      console.error('PDF 워커 초기화 실패:', error);
      reject(error);
    }
  });
  
  return workerInitPromise;
};

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
    setErr(null);

    (async () => {
      if (!pdfSrc || typeof pdfSrc !== "string" || !pdfSrc.trim()) {
        setErr("PDF URL이 비어있습니다.");
        setLoading(false);
        return;
      }
      
      try {
        console.log(`PDF 로딩 시작: ${pdfSrc}`);
        
        // 1단계: 워커 초기화 (필수)
        if (typeof window !== 'undefined') {
          await initializeWorker();
          if (cancelled) return;
        }
        
        console.log('워커 초기화 완료, PDF 문서 로딩 시작');
        
        // 2단계: PDF 문서 로딩
        const task = getDocument({ 
          url: pdfSrc,
          // 워커가 이미 초기화되었으므로 기본 설정 사용
        });
        
        const loaded = await task.promise;
        if (cancelled) return;
        
        console.log(`PDF 문서 로딩 완료: ${loaded.numPages}페이지`);
        setPdf(loaded);
        setNumPages(loaded.numPages);
        setLoading(false);
        
      } catch (e: any) {
        if (cancelled) return;
        console.error("PDF 로딩 실패:", e);
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
