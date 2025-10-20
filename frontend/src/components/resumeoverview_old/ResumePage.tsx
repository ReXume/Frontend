"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useResumeStore from "@/store/ResumeStore";
import { FeedbackPoint } from "@/types/FeedbackPointType.js";
import { useSearchParams } from "next/navigation";

// 일반 PDF 버전 (IntersectionObserver)
const PDFViewerStandard = dynamic(() => import("./pdf/PDFViewer"), {
  ssr: false,
  loading: () => <div>PDF 로딩 중... (일반 버전)</div>,
});

// PDF Queue 버전 (RenderScheduler)
const PDFViewerQueue = dynamic(() => import("./pdfQueue/PDFViewer"), {
  ssr: false,
  loading: () => <div>PDF 로딩 중... (Queue 버전)</div>,
});

// PDF Simple 버전 (단순 IntersectionObserver)
const PDFViewerSimple = dynamic(() => import("./pdfSimple/PDFViewer"), {
  ssr: false,
  loading: () => <div>PDF 로딩 중... (Simple 버전)</div>,
});

// PDF rAF 버전 (requestAnimationFrame)
const PDFViewerRAF = dynamic(() => import("./pdfRAF/PDFViewer"), {
  ssr: false,
  loading: () => <div>PDF 로딩 중... (rAF 버전)</div>,
});

// PDF Lazy 버전 (지연된 getPage 호출)
const PDFViewerLazy = dynamic(() => import("./pdfLazy/PDFViewer"), {
  ssr: false,
  loading: () => <div>PDF 로딩 중... (Lazy 버전)</div>,
});



type ResumePageProps = {
  pageNumber: number;
  feedbackPoints: FeedbackPoint[];
  // addFeedbackPoint: (point: Omit<AddFeedbackPoint, "id">) => void;
  // deleteFeedbackPoint: (id: number) => void;
  // editFeedbackPoint: (item: AddFeedbackPoint) => void;
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
  setClickedCommentId: (id: number | null) => void;
};

function ResumePage({
  pageNumber,
  feedbackPoints,
  // addFeedbackPoint,
  // editFeedbackPoint,
  hoveredCommentId,
  // setHoveredCommentId,
  // setClickedCommentId,
}: ResumePageProps) {
  const searchParams = useSearchParams();
  const version = searchParams.get('version') || 'pdf'; // 기본값: 'pdf'
  const pageRef = useRef<HTMLDivElement>(null);
  const [, setAddingFeedback] = useState<{
    x: number;
    y: number;
    pageNumber: number;
  } | null>(null);
  // const [editingFeedback, setEditingFeedback] = useState<FeedbackPoint | null>(
  //   null
  // );

  const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100; // 백분율
    const y = ((e.clientY - rect.top) / rect.height) * 100; // 백분율

    setAddingFeedback({ x, y, pageNumber });
  };

  // const handleMarkerClick = (point: FeedbackPoint) => {
  //   setEditingFeedback(point);
  // };

  // const handleAddSubmit = (comment: string) => {
  //   if (addingFeedback) {
  //     // addFeedbackPoint({
  //     //   pageNumber: addingFeedback.pageNumber,
  //     //   xCoordinate: addingFeedback.x,
  //     //   yCoordinate: addingFeedback.y,
  //     //   content: comment,
  //     // });
  //     setAddingFeedback(null);
  //   }
  // };

  // const handleEditSubmit = () => {
  //   if (editingFeedback) {
  //     const updatedPoint: AddFeedbackPoint = { ...editingFeedback };
  //     // editFeedbackPoint(updatedPoint);
  //     setEditingFeedback(null);
  //   }
  // };

  // const handleCancel = () => {
  //   setAddingFeedback(null);
  //   setEditingFeedback(null);
  // };

  const { ResumeUrl } = useResumeStore();

  useEffect(() => {
    console.log({ ResumeUrl, version });
  }, [ResumeUrl, version]);

  // 버전에 따라 사용할 PDFViewer 선택
  const PDFViewer = 
    version === 'queue' ? PDFViewerQueue :
    version === 'simple' ? PDFViewerSimple :
    version === 'raf' ? PDFViewerRAF :
    version === 'lazy' ? PDFViewerLazy :
    PDFViewerStandard;

  // 버전별 표시 정보
  const versionInfo: Record<string, { label: string; color: string; description: string }> = {
    pdf: { 
      label: '📄 일반 PDF (IntersectionObserver)', 
      color: 'bg-blue-100',
      description: '뷰포트에 보이면 즉시 렌더링'
    },
    simple: { 
      label: '🎯 PDF Simple (단순 IntersectionObserver)', 
      color: 'bg-purple-100',
      description: '스케줄러 없이 단순한 지연 로딩'
    },
    queue: { 
      label: '⚡ PDF Queue (RenderScheduler)', 
      color: 'bg-green-100',
      description: '렌더링 큐 관리, 우선순위 기반'
    },
    fixed: { 
      label: '🔒 고정 K=5 스케줄러', 
      color: 'bg-gray-100',
      description: '동시 렌더링 5개 고정'
    },
    adaptive: { 
      label: '⚡ 적응형 스케줄러', 
      color: 'bg-emerald-100',
      description: 'Long Task 기반 자동 조절 (1~6)'
    },
    raf: { 
      label: '🎬 PDF rAF (requestAnimationFrame)', 
      color: 'bg-orange-100',
      description: 'requestAnimationFrame을 사용한 렌더링 최적화'
    },
    lazy: { 
      label: '🐌 PDF Lazy (지연된 getPage)', 
      color: 'bg-yellow-100',
      description: '페이지 크기 미리 계산 제거, 관찰 후에만 getPage() 호출'
    },
  };

  const currentVersion = versionInfo[version] || versionInfo.pdf;

  return (
    <div className="relative mb-8">
      {/* 현재 사용 중인 버전 표시 */}
      <div className={`mb-2 px-4 py-2 ${currentVersion.color} rounded-md text-sm text-gray-700 font-medium`}>
        <div>현재 버전: {currentVersion.label}</div>
        <div className="text-xs text-gray-600 mt-1">{currentVersion.description}</div>
      </div>
      <div
        ref={pageRef}
        className="w-full h-[903px] items-center relative cursor-pointer -mt-1"
        onClick={handleClick}
      >
        <PDFViewer
          pdfSrc={ResumeUrl}
          pageNumber={pageNumber}
          addFeedbackPoint={() => {}} // 임시 함수
          editFeedbackPoint={() => {}} // 임시 함수
          feedbackPoints={feedbackPoints}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={() => {}} // 임시 함수
          setClickedCommentId={() => {}} // 임시 함수
        />
      </div>
    </div>
  );
}

export default ResumePage;
