"use client";

import { useEffect, useState, useRef } from "react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist/build/pdf"; 

import PDF from "./PDF";
import { FeedbackPoint } from "@/types/FeedbackPointType";
import { AddFeedbackPoint } from "@/types/AddFeedbackPointType";
import { renderScheduler } from "@/libs/renderScheduler";

// 워커 초기화 상태 관리
let workerInitialized = false;

// 워커 초기화 함수
const initializeWorker = (): void => {
  if (workerInitialized) return;
  
  try {
    console.log('PDF 워커 초기화 시작');
    
    // public 폴더의 워커 파일 사용 (가장 안정적)
    GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    
    console.log('PDF 워커 경로 설정 완료:', GlobalWorkerOptions.workerSrc);
    workerInitialized = true;
    
  } catch (error) {
    console.error('PDF 워커 초기화 실패:', error);
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
  
  // 각 페이지별 렌더링 상태 관리
  const pageRenderStates = useRef<Map<number, { rendered: boolean; task: RenderTask | null }>>(new Map());
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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
          initializeWorker();
          if (cancelled) return;
        }
        
        console.log('워커 초기화 완료, PDF 문서 로딩 시작');
        
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

  // IntersectionObserver 설정
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!pdf || numPages === 0) return;

    // observer 생성
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageElement = entry.target as HTMLDivElement;
          const pageNumber = parseInt(pageElement.dataset.pageNumber || '1');
          const jobId = `page-${pageNumber}`;

          if (entry.isIntersecting) {
            const renderState = pageRenderStates.current.get(pageNumber);
            
            // 이미 렌더링되었으면 스킵
            if (renderState?.rendered) {
              console.log(`Page ${pageNumber} already rendered`);
              return;
            }

            // 뷰포트 근접 페이지 우선 렌더
            const rect = pageElement.getBoundingClientRect();
            const center = rect.top + rect.height / 2;
            const priority = Math.abs(center - (typeof window !== 'undefined' ? window.innerHeight / 2 : 0));

            console.log(`Enqueuing page ${pageNumber} with priority ${priority}`);
            
            renderScheduler.enqueue({
              id: jobId,
              priority,
              run: async () => {
                const currentRenderState = pageRenderStates.current.get(pageNumber);
                if (currentRenderState?.rendered || !pdf) return;

                console.log(`Starting render for page ${pageNumber}`);
                
                // 성능 측정 시작
                const t0 = performance.now();
                
                const page = await pdf.getPage(pageNumber);
                const t1 = performance.now();
                
                const viewport = page.getViewport({ scale: 2, rotation: 0 });
                const canvas = pageElement.querySelector('canvas') as HTMLCanvasElement;
                
                if (!canvas) {
                  console.error(`Canvas not found for page ${pageNumber}`);
                  return;
                }
                
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                  console.error(`Context not found for page ${pageNumber}`);
                  return;
                }

                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // 기존 렌더 취소
                if (currentRenderState?.task) {
                  try {
                    currentRenderState.task.cancel();
                  } catch {}
                }

                const task = page.render({ canvasContext: ctx, viewport });
                pageRenderStates.current.set(pageNumber, { rendered: false, task });

                try {
                  await task.promise;
                  const t2 = performance.now();
                  
                  await new Promise<void>((r) =>
                    requestAnimationFrame(() =>
                      requestAnimationFrame(() => r())
                    )
                  );
                  const t3 = performance.now();
                  
                  pageRenderStates.current.set(pageNumber, { rendered: true, task });
                  
                  // Canvas 표시
                  canvas.style.display = "block";
                  const placeholder = pageElement.querySelector('.pdf-placeholder') as HTMLElement;
                  if (placeholder) {
                    placeholder.style.display = "none";
                  }
                  
                  // 메트릭 수집
                  const metrics = {
                    page: pageNumber,
                    getPageMs: parseFloat((t1 - t0).toFixed(1)),
                    renderMs: parseFloat((t2 - t1).toFixed(1)),
                    paintMs: parseFloat((t3 - t2).toFixed(1)),
                    totalMs: parseFloat((t3 - t0).toFixed(1)),
                  };
                  
                  console.log(`Page ${pageNumber} rendered successfully - getPage: ${metrics.getPageMs}ms, render: ${metrics.renderMs}ms, paint: ${metrics.paintMs}ms, total: ${metrics.totalMs}ms`);
                  
                  // 벤치마크 메트릭 수집기에 전달
                  if (typeof window !== 'undefined' && (window as any).pdfRenderMetricsCollector) {
                    (window as any).pdfRenderMetricsCollector.add(metrics);
                  }
                } catch (e: any) {
                  if (e?.name === "RenderingCancelledException") {
                    console.log(`Page ${pageNumber} rendering cancelled`);
                  } else {
                    console.error(`page ${pageNumber} render error`, e);
                  }
                }
              },
              cancel: () => {
                const currentRenderState = pageRenderStates.current.get(pageNumber);
                if (currentRenderState?.task) {
                  try {
                    currentRenderState.task.cancel();
                  } catch {}
                }
              },
            });
          } else {
            // 화면에서 멀어지면 취소
            console.log(`Page ${pageNumber} out of view, cancelling`);
            renderScheduler.cancel(jobId);
          }
        });
      },
      {
        root: null,
        threshold: 0,
        rootMargin: `${typeof window !== 'undefined' ? window.innerHeight * 0.25 : 2000}px 0px`,
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      // 모든 대기 중인 작업 취소
      for (let i = 1; i <= numPages; i++) {
        renderScheduler.cancel(`page-${i}`);
      }
    };
  }, [pdf, numPages]);

  // 페이지 요소가 추가될 때마다 observer에 등록
  const handlePageRef = (pageNumber: number, element: HTMLDivElement | null) => {
    if (element && observerRef.current) {
      pageRefs.current.set(pageNumber, element);
      observerRef.current.observe(element);
      // 렌더 상태 초기화
      if (!pageRenderStates.current.has(pageNumber)) {
        pageRenderStates.current.set(pageNumber, { rendered: false, task: null });
      }
    }
  };

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
      {Array.from({ length: numPages }).map((_, idx) => {
        const pageNumber = idx + 1;
        return (
          <PDF
            key={`page-${pageNumber}`}
            ref={(el) => handlePageRef(pageNumber, el)}
            pdf={pdf}
            pageNumber={pageNumber}
            feedback={[]}
            addFeedbackPoint={addFeedbackPoint}
            feedbackPoints={feedbackPoints}
            hoveredCommentId={hoveredCommentId}
            setHoveredCommentId={setHoveredCommentId}
            setClickedCommentId={setClickedCommentId}
          />
        );
      })}
    </div>  
  );
};

export default PDFViewer;
