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
import { renderSchedulerDeviceAware } from "@/libs/renderSchedulerDeviceAware";

// 워커 초기화 상태 관리
let workerInitialized = false;

// 워커 초기화 함수
const initializeWorker = (): void => {
  if (workerInitialized) return;
  
  try {
    console.log('[Device-Aware] PDF 워커 초기화 시작');
    
    // public 폴더의 워커 파일 사용
    GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    
    console.log('[Device-Aware] PDF 워커 경로 설정 완료:', GlobalWorkerOptions.workerSrc);
    workerInitialized = true;
    
  } catch (error) {
    console.error('[Device-Aware] PDF 워커 초기화 실패:', error);
    throw error;
  }
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
  addFeedbackPoint,
  feedbackPoints,
  hoveredCommentId,
  setHoveredCommentId,
  setClickedCommentId,
}: PDFViewerProps) => {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 컴포넌트 마운트 시 기기 정보 출력
  useEffect(() => {
    const config = renderSchedulerDeviceAware.getConfig();
    const tier = renderSchedulerDeviceAware.getDeviceTier();
    
    console.log('[Device-Aware PDFViewer] 초기화됨');
    console.log(`  - 기기 티어: ${tier.toUpperCase()}`);
    console.log(`  - 동시 렌더 상한 (K): ${config.concurrency}`);
    console.log(`  - IO 디바운스: ${config.ioDebounceMs}ms`);
    console.log(`  - Viewport Margin: ${config.viewportMarginVh}vh`);
  }, []);

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
        console.log(`[Device-Aware] PDF 로딩 시작: ${pdfSrc}`);
        
        // 1단계: 워커 초기화 (필수)
        if (typeof window !== 'undefined') {
          initializeWorker();
          if (cancelled) return;
        }
        
        console.log('[Device-Aware] 워커 초기화 완료, PDF 문서 로딩 시작');
        
        // 2단계: PDF 문서 로딩
        const task = getDocument({ 
          url: pdfSrc,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/',
          isEvalSupported: false,
          useSystemFonts: false,
        });
        
        const loaded = await task.promise;
        if (cancelled) return;
        
        console.log(`[Device-Aware] PDF 문서 로딩 완료: ${loaded.numPages}페이지`);
        setPdf(loaded);
        setNumPages(loaded.numPages);
        setLoading(false);
        
      } catch (e: any) {
        if (cancelled) return;
        console.error("[Device-Aware] PDF 로딩 실패:", e);
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

