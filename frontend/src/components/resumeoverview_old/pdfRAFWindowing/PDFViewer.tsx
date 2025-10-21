"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist/build/pdf";

import PDF from "./PDF";
import { FeedbackPoint } from "@/types/FeedbackPointType";
import { AddFeedbackPoint } from "@/types/AddFeedbackPointType";

// ForwardRef로 받은 DOM에 붙는 메서드 타입
interface PDFElement extends HTMLDivElement {
  renderPage?: () => Promise<void>;
  rendered?: () => boolean;
  resetPage?: () => void;
}

let workerInitialized = false;
const initializeWorker = (): void => {
  if (workerInitialized) return;
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
  workerInitialized = true;
};

interface PDFViewerProps {
  pdfSrc: string;
  addFeedbackPoint: (point: Omit<AddFeedbackPoint, "id">) => void;
  editFeedbackPoint: (point: FeedbackPoint) => void;
  feedbackPoints: FeedbackPoint[];
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
  setClickedCommentId: (id: number | null) => void;
}

/** 간단한 우선순위 스케줄러: 근접도 우선 + 동시성 K */
class RenderScheduler {
  private K: number;
  private inFlight = 0;
  private q: { id: string; priority: number; run: () => Promise<void> }[] = [];
  private enqueued = new Set<string>();

  constructor(K = 4) {
    this.K = K;
  }
  setConcurrency(k: number) {
    this.K = Math.max(1, k);
    this.drain();
  }
  enqueue(job: { id: string; priority: number; run: () => Promise<void> }) {
    if (this.enqueued.has(job.id)) return;
    this.enqueued.add(job.id);
    this.q.push(job);
    // priority 낮을수록 먼저
    this.q.sort((a, b) => a.priority - b.priority);
    this.drain();
  }
  private drain() {
    while (this.inFlight < this.K && this.q.length) {
      const job = this.q.shift()!;
      this.inFlight++;
      job
        .run()
        .catch(() => {})
        .finally(() => {
          this.inFlight--;
          this.enqueued.delete(job.id);
          this.drain();
        });
    }
  }
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

  // 🧩 1️⃣ Incremental Mount - 점진적 마운트를 위한 상태
  const [visiblePages, setVisiblePages] = useState<number[]>([]);
  const mountingRef = useRef({ isRunning: false, currentIndex: 1 });

  // 페이지 DOM 보관
  const pageElements = useRef<Map<number, PDFElement>>(new Map());
  // Shared IO / Scheduler
  const observerRef = useRef<IntersectionObserver | null>(null);
  const schedulerRef = useRef<RenderScheduler>(new RenderScheduler(4));

  // PDF 로딩
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        if (!pdfSrc?.trim()) {
          throw new Error("PDF URL이 비어있습니다.");
        }
        initializeWorker();
        const task = getDocument({
          url: pdfSrc,
          cMapUrl:
            "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
          standardFontDataUrl:
            "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/",
          isEvalSupported: false,
          useSystemFonts: false,
        });
        const loaded = await task.promise;
        if (cancelled) return;
        setPdf(loaded);
        setNumPages(loaded.numPages);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "PDF 로딩 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfSrc]);

  // 🧩 1️⃣ Incremental Mount - 점진적 마운트 시작
  useEffect(() => {
    if (!numPages) return;

    // 기존 마운트 중인 경우 정리
    mountingRef.current.isRunning = false;
    setVisiblePages([]); // 초기화

    let rafId: number;
    let currentStartIndex = 1;
    const batchSize = 3; // 한 프레임당 3개씩 추가

    const mountNextBatch = (startIndex?: number) => {
      // 파라미터로 받은 인덱스가 있으면 사용, 없으면 현재 인덱스 사용
      const workingIndex = startIndex !== undefined ? startIndex : currentStartIndex;
      
      // 현재 배치에서 처리할 페이지들 계산
      const pagesToAdd = [];
      for (let i = 0; i < batchSize && (workingIndex + i) <= numPages; i++) {
        pagesToAdd.push(workingIndex + i);
      }

      console.log(`🔄 Batch 시작: workingIndex=${workingIndex}, 추가할 페이지들=[${pagesToAdd.join(', ')}]`);

      setVisiblePages((prev) => {
        const next = [...prev];
        
        // 새로 추가될 페이지만 처리
        pagesToAdd.forEach(pageNumber => {
          if (!next.includes(pageNumber)) {
            next.push(pageNumber);
            console.log(`🧩 페이지 ${pageNumber} 마운트됨 (${next.length}/${numPages})`);
          }
        });
        
        return next;
      });

      // 다음 배치를 위한 인덱스 계산
      const nextStartIndex = workingIndex + batchSize;
      currentStartIndex = nextStartIndex;
      mountingRef.current.currentIndex = nextStartIndex;
      console.log(`➡️ 다음 배치: nextStartIndex=${nextStartIndex}`);
      
      // 아직 마운트할 페이지가 남아있으면 다음 프레임에서 계속
      if (nextStartIndex <= numPages) {
        rafId = requestAnimationFrame(() => mountNextBatch(nextStartIndex));
      } else {
        console.log('🧩 Incremental Mount 완료!', numPages, 'pages mounted');
      }
    };

    // 첫 번째 배치를 다음 프레임에 시작 (1부터 시작)
    rafId = requestAnimationFrame(() => mountNextBatch(1));

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      mountingRef.current.isRunning = false;
    };
  }, [numPages]);

  /** rAF 배칭을 위한 pending 집합 */
  const pendingRef = useRef<Set<number>>(new Set());
  const scheduledRef = useRef(false);

  const flushInRaf = useCallback(() => {
    if (scheduledRef.current) return;
    scheduledRef.current = true;
    requestAnimationFrame(() => {
      scheduledRef.current = false;
      const pages = Array.from(pendingRef.current);
      pendingRef.current.clear();

      // 우선순위 = viewport 중심으로부터의 거리(px)
      const viewportCenter =
        typeof window !== "undefined"
          ? window.scrollY + window.innerHeight / 2
          : 0;

      pages
        .filter(n => visiblePages.includes(n)) // 마운트된 페이지만 처리
        .map((n) => {
          const el = pageElements.current.get(n);
          const rect = el?.getBoundingClientRect();
          const pageCenter =
            (rect?.top ?? 0) + window.scrollY + (rect?.height ?? 0) / 2;
          const priority = Math.abs(pageCenter - viewportCenter);
          return { n, el, priority };
        })
        .filter(({ el }) => el) // DOM 요소가 존재하는 경우만
        .sort((a, b) => a.priority - b.priority)
        .forEach(({ n, el, priority }) => {
          // 이미 렌더링 완료면 스킵
          if (el.rendered?.()) return;

          schedulerRef.current.enqueue({
            id: `page-${n}`,
            priority,
            run: async () => {
              // 중간에 attach 안됐으면 skip
              if (!el.renderPage) return;
              await el.renderPage();
            },
          });
        });
    });
  }, [visiblePages]);

  // Shared IO 생성/정리
  useEffect(() => {
    if (!pdf || numPages === 0) return;

    const margin =
      typeof window !== "undefined"
        ? Math.round(window.innerHeight * 0.75) // 75vh 프리워밍
        : 1200;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let touched = false;
        for (const entry of entries) {
          const target = entry.target as PDFElement;
          const n = Number((target.dataset.pageNumber as string) ?? "1");
          
          // 마운트된 페이지만 관찰
          if (!visiblePages.includes(n)) continue;
          
          if (entry.isIntersecting) {
            touched = true;
            pendingRef.current.add(n);
          } else {
            // 교차 해제 시 굳이 큐에 남겨둘 필요 없음
            pendingRef.current.delete(n);
          }
        }
        if (touched) flushInRaf(); // IO 콜백 → rAF 배칭
      },
      {
        root: null,
        threshold: 0,
        rootMargin: `${margin}px 0px`,
      }
    );

    // 이미 등록된 페이지 중 마운트된 페이지만 attach
    pageElements.current.forEach((el, pageNumber) => {
      if (visiblePages.includes(pageNumber)) {
        observerRef.current!.observe(el);
      }
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      pendingRef.current.clear();
      scheduledRef.current = false;
      // 스케줄러는 유지(리스트 새로 렌더 시에도 in-flight 마무리 가능)
    };
  }, [pdf, numPages, flushInRaf, visiblePages]);


  // callback ref: 마운트 순간에 바로 observe (Effect 재실행 최소화)
  const attachPageRef = useCallback((pageNumber: number) => {
    return (el: HTMLDivElement | null) => {
      if (!el) {
        pageElements.current.delete(pageNumber);
        return;
      }
      const cast = el as PDFElement;
      cast.dataset.pageNumber = String(pageNumber);
      pageElements.current.set(pageNumber, cast);
      
      // 마운트된 페이지만 관찰 시작
      if (visiblePages.includes(pageNumber)) {
        observerRef.current?.observe(cast);
      }
    };
  }, [visiblePages]);

  if (err) return <div>{err}</div>;
  if (loading || !pdf) return <div>PDF 로딩 중...</div>;

  return (
    <div className="relative">
      {/* 🧩 Incremental Mount 정보 표시 */}
      <div className="fixed top-4 right-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded text-sm z-10">
        <div>🧩 Incremental Mount rAF</div>
        <div>마운트됨: {visiblePages.length}/{numPages}개</div>
        <div>대기 중: {pendingRef.current.size}개</div>
        <div>진행률: {numPages > 0 ? Math.round((visiblePages.length / numPages) * 100) : 0}%</div>
        <div className="text-xs mt-1">
          마운트된 페이지: {visiblePages.slice(0, 5).join(', ')}
          {visiblePages.length > 5 && '...'}
        </div>
      </div>

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
          const isVisible = visiblePages.includes(pageNumber);
          
          // 점진적 마운트: visiblePages에 포함된 페이지만 렌더링
          if (!isVisible) {
            return (
              <div
                key={`placeholder-${pageNumber}`}
                style={{
                  width: "100%",
                  height: 1200,
                  marginBottom: 20,
                  background: "#f9fafb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#6b7280",
                  fontSize: "14px",
                }}
              >
                페이지 {pageNumber} (로딩 중...)
              </div>
            );
          }

          return (
            <PDF
              key={`page-${pageNumber}`}
              ref={attachPageRef(pageNumber)}
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
    </div>
  );
};

export default PDFViewer;