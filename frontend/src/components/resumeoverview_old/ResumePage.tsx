import React, { useRef, useState } from "react";
import useResumeStore from "@/store/ResumeStore";
import PDFViewer from "./PDFViewer";
import { FeedbackPoint } from "@/types/FeedbackPointType.js";
import { AddFeedbackPoint } from "@/types/AddFeedbackPointType.js";

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
  setHoveredCommentId,
  setClickedCommentId,
}: ResumePageProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [addingFeedback, setAddingFeedback] = useState<{
    x: number;
    y: number;
    pageNumber: number;
  } | null>(null);
  const [editingFeedback, setEditingFeedback] = useState<FeedbackPoint | null>(
    null
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100; // 백분율
    const y = ((e.clientY - rect.top) / rect.height) * 100; // 백분율

    setAddingFeedback({ x, y, pageNumber });
  };

  const handleMarkerClick = (point: FeedbackPoint) => {
    setEditingFeedback(point);
  };

  const handleAddSubmit = (comment: string) => {
    if (addingFeedback) {
      // addFeedbackPoint({
      //   pageNumber: addingFeedback.pageNumber,
      //   xCoordinate: addingFeedback.x,
      //   yCoordinate: addingFeedback.y,
      //   content: comment,
      // });
      setAddingFeedback(null);
    }
  };

  const handleEditSubmit = () => {
    if (editingFeedback) {
      const updatedPoint: AddFeedbackPoint = { ...editingFeedback };
      // editFeedbackPoint(updatedPoint);
      setEditingFeedback(null);
    }
  };

  const handleCancel = () => {
    setAddingFeedback(null);
    setEditingFeedback(null);
  };

  const { ResumeUrl } = useResumeStore();

  return (
    <div className="relative mb-8">
      <div
        ref={pageRef}
        className="w-full h-[903px] items-center relative cursor-pointer -mt-1"
        onClick={handleClick}
      >
        <PDFViewer
          pdfSrc={ResumeUrl}
          pageNumber={pageNumber}
          // addFeedbackPoint={addFeedbackPoint}
          // editFeedbackPoint={editFeedbackPoint}
          feedbackPoints={feedbackPoints}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          setClickedCommentId={setClickedCommentId}
        />
      </div>
    </div>
  );
}

export default ResumePage;
