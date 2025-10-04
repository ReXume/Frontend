'use client';

import React, { useState } from "react";
import CommentList from "./CommentList";
import CommentForm from "./CommentForm";
import ErrorMessage from "../UI_old/ErrorMessage";
import LoadingSpinner from "../UI_old/LoadingSpinner";
import { FeedbackPoint } from "@/types/FeedbackPointType";
// auth 제거

interface CommentSectionProps {
  feedbackPoints: FeedbackPoint[];
  // addFeedbackPoint: (point: Omit<AddFeedbackPoint, "id">) => void;
  // deleteFeedbackPoint: (id: number) => void;
  // editFeedbackPoint: (item: FeedbackPoint) => void;
  hoveredCommentId: number | null;
  // setHoveredCommentId: (id: number | null) => void;
  // handleAiFeedback: () => void;
  loading?: boolean;
  error?: string;
  // onClickedCommentId: number | null;
}

function CommentSection({
  feedbackPoints,
  // addFeedbackPoint,
  // deleteFeedbackPoint,
  // editFeedbackPoint,
  hoveredCommentId,
  // setHoveredCommentId,
  // handleAiFeedback,
  loading = false,
  error = "",
  // onClickedCommentId,
}: CommentSectionProps): React.ReactElement {
  const [isLogin] = useState(false);

  // const handleAddComment = async (text: string) => {
  //   try {
  //     addFeedbackPoint({
  //       content: text,
  //       x1: 0,
  //       x2: 0,
  //       y1: 0,
  //       y2: 0,
  //       pageNumber: 1,
  //     });
  //   } catch (error) {
  //     console.error("Failed to add comment", error);
  //   }
  // };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">댓글</h3>

      {/* 에러 메시지 */}
      {error && <ErrorMessage message={error} />}

      {/* 댓글 목록 */}
      <div className="mt-4 overflow-y-auto h-[33vh]">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <CommentList
            feedbackPoints={feedbackPoints ?? []}
            hoveredCommentId={hoveredCommentId}
            // setHoveredCommentId={setHoveredCommentId}
          />
        )}
      </div>

      {/* 댓글 추가 입력 */}
      <div className="mt-6">
        <h4 className="text-md font-medium text-gray-700 mb-2">댓글 작성</h4>
        <CommentForm
          // onAdd={handleAddComment}
          // onAiFeedback={handleAiFeedback}
          disabled={!isLogin}
        />
      </div>
    </div>
  );
}

export default CommentSection;
