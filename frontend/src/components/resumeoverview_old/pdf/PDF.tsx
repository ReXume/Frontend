"use client";

import React, { useState, useRef, useEffect } from "react";
import CommentForm from "../../comment_old/CommentForm";
import { FeedbackPoint } from "@/types/FeedbackPointType";

import { GlobalWorkerOptions, getDocument, type PDFPageProxy, type PDFDocumentProxy, RenderTask } from "pdfjs-dist";



interface PDFProps {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  feedback: FeedbackPoint[];
  addFeedbackPoint: (point: {
    pageNumber: number;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    content: string;
  }) => void;
  feedbackPoints: FeedbackPoint[];
  // editFeedbackPoint: (item: FeedbackPoint) => void;
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
  setClickedCommentId: (id: number | null) => void;
}

const PDF: React.FC<PDFProps> = ({
  pdf,
  pageNumber,
  // feedback,
  addFeedbackPoint,
  feedbackPoints,
  // editFeedbackPoint,
  hoveredCommentId,
  // setHoveredCommentId,
  // setClickedCommentId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const [selectedArea, setSelectedArea] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [addingFeedback, setAddingFeedback] = useState<{
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    pageNumber: number;
  } | null>(null);
  const [editingFeedback] = useState<FeedbackPoint | null>(
    null
  );

  // IntersectionObserver로 뷰포트 감지
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
        });
      },
      {
        root: null, // viewport 기준
        rootMargin: '200px', // 뷰포트 200px 전에 미리 로드
        threshold: 0.01, // 1%만 보여도 감지
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // 뷰포트에 보일 때만 렌더링
  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    const maxRetries = 3;

    const loadPage = async () => {
      let retries = 0;
    
      const attempt = async () => {
        try {
          const pageLabel = `p${pageNumber}`;
          const t0 = performance.now();
          console.log(`PDF 렌더 시작 (${pageLabel})`);
    
          // 1) 페이지 얻기
          const page = await pdf.getPage(pageNumber);
          const t1 = performance.now();
    
          // 2) 뷰포트/캔버스 준비
          const viewport = page.getViewport({ scale: 2, rotation: 0 });
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas Context 생성 실패");
    
          canvas.width = viewport.width;
          canvas.height = viewport.height;
    
          // 3) 기존 렌더 취소
          if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
          }
    
          // 4) 렌더
          const renderTask = page.render({ canvasContext: ctx, viewport });
          renderTaskRef.current = renderTask;
          await renderTask.promise;
          const t2 = performance.now();
    
          // 5) 실제 페인트 커밋까지 대기
          await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
          const t3 = performance.now();
    
          if (cancelled) return;
    
          // 메트릭 수집
          const metrics = {
            page: pageNumber,
            getPageMs: parseFloat((t1 - t0).toFixed(1)),
            renderMs: parseFloat((t2 - t1).toFixed(1)),
            paintMs: parseFloat((t3 - t2).toFixed(1)),
            totalMs: parseFloat((t3 - t0).toFixed(1)),
          };
          
          console.log(
            `PDF 렌더 완료 (${pageLabel}) ` +
            `getPage: ${metrics.getPageMs}ms, ` +
            `render: ${metrics.renderMs}ms, ` +
            `paint: ${metrics.paintMs}ms, ` +
            `total: ${metrics.totalMs}ms`
          );
          
          // 벤치마크 메트릭 수집기에 전달
          if (typeof window !== 'undefined' && (window as any).pdfRenderMetricsCollector) {
            (window as any).pdfRenderMetricsCollector.add(metrics);
          }
    
        } catch (err: any) {
          if (cancelled) return;
          if (err?.name === "RenderingCancelledException") return;
    
          console.error(`PDF 렌더 에러 (페이지 ${pageNumber}):`, err);
    
          if (retries < maxRetries) {
            retries += 1;
            const backoff = 500 * retries;
            console.log(`재시도 ${retries}/${maxRetries} (대기 ${backoff}ms)`);
            await new Promise((r) => setTimeout(r, backoff));
            if (!cancelled) {
              return attempt();
            }
          } else {
            console.error(`최종 실패 (페이지 ${pageNumber}): 최대 재시도 초과`);
          }
        }
      };
    
      return attempt();
    };
    
    loadPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdf, pageNumber, isVisible]);

  // hover 핸들러 캡슐화: 콘솔 로그로 확인
  // const handleHover = (id: number | null) => {
  //   setHoveredCommentId(id);
  // };

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setSelectedArea({ x, y, width: 0, height: 0 });
    setIsSelecting(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectedArea) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    setSelectedArea({
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      width: Math.abs(currentX - startPos.x),
      height: Math.abs(currentY - startPos.y),
    });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    setIsSelecting(false);
    if (selectedArea) {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const percentX1 = (selectedArea.x / rect.width) * 100;
      const percentX2 =
        ((selectedArea.x + selectedArea.width) / rect.width) * 100;
      const percentY1 = (selectedArea.y / rect.height) * 100;
      const percentY2 =
        ((selectedArea.y + selectedArea.height) / rect.height) * 100;
      setAddingFeedback({
        x1: percentX1,
        x2: percentX2,
        y1: percentY1,
        y2: percentY2,
        pageNumber,
      });
    }
  };

  const handleAddSubmit = (comment: string) => {
    if (addingFeedback) {
      addFeedbackPoint({
        pageNumber: addingFeedback.pageNumber,
        x1: addingFeedback.x1,
        x2: addingFeedback.x2,
        y1: addingFeedback.y1,
        y2: addingFeedback.y2,
        content: comment,
      });
      setAddingFeedback(null);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", marginBottom: 20, minHeight: 800 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* 캔버스 표시 */}
      <canvas ref={canvasRef} style={{ display: "block" }} />
      {/* 캔버스 표시 */}


      {/* 선택 영역 표시 */}
      {selectedArea && (
        <div
          style={{
            position: "absolute",
            left: selectedArea.x,
            top: selectedArea.y,
            width: selectedArea.width,
            height: selectedArea.height,
            border: "2px dashed blue",
            pointerEvents: "none",
          }}
        />
      )}

      {feedbackPoints
        .filter((item) => item.pageNumber === pageNumber)
        .map((item) => {
          const fp: FeedbackPoint = item as FeedbackPoint;
          const left = fp.x1 ?? fp.x1 ?? 0;
          const top = fp.y1 ?? fp.y1 ?? 0;
          const width = (fp.x2 ?? left) - left || 10;
          const height = (fp.y2 ?? top) - top || 10;
          const key = fp.id ?? fp.id;
          const isHovered = (fp.id ?? fp.id) === hoveredCommentId;
          return (
            <div
              key={key}
              style={{
                position: "absolute",
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                border: isHovered ? "2px solid #3B82F6" : "2px solid #EF4444",
                background: isHovered
                  ? "rgba(59,130,246,0.3)"
                  : "rgba(255,0,0,0.3)",
                cursor: "pointer",
              }}
            />
          );
        })}

      {addingFeedback && (
        <CommentForm
          position={{ x1: addingFeedback.x1, y1: addingFeedback.y1 }}
          onSubmit={handleAddSubmit}
        />
      )}
      {editingFeedback && (
        <CommentForm
          position={{
            x1: editingFeedback.x1,
            y1: editingFeedback.y1,
          }}
          initialComment={editingFeedback.content}
        />
      )}
    </div>
  );
};

export default PDF;
