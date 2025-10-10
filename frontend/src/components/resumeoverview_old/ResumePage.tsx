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
  const PDFViewer = version === 'queue' ? PDFViewerQueue : PDFViewerStandard;

  return (
    <div className="relative mb-8">
      {/* 현재 사용 중인 버전 표시 */}
      <div className="mb-2 px-4 py-2 bg-blue-100 rounded-md text-sm text-gray-700 font-medium">
        현재 버전: {version === 'queue' ? '⚡ PDF Queue (RenderScheduler)' : '📄 일반 PDF (IntersectionObserver)'}
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
