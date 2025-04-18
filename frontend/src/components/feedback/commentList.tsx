"use client";

import { FeedbackPoint } from "@/types/FeedbackPointType";

type CommentListProps = {
  feedbackPoints: FeedbackPoint[];
  deleteFeedbackPoint: (id: number) => void;
  editFeedbackPoint: (item: FeedbackPoint) => void;
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
};

function CommentList({
  feedbackPoints,
  deleteFeedbackPoint,
  editFeedbackPoint,
  hoveredCommentId,
  setHoveredCommentId,
}: CommentListProps) {
  return (
    <ul>
      {feedbackPoints.map((item) => {
        const isAiFeedback = item.content.startsWith("AI피드백:");
        const contentWithoutPrefix = isAiFeedback
          ? item.content.slice("AI피드백:".length)
          : item.content;

        const username = "익명";
        const timestamp = "";
        const initials = username.substring(0, 2);

        return (
          <li
            key={item.id}
            className={`mb-4 ${
              item.id === hoveredCommentId ? "bg-blue-100" : ""
            }`}
            onMouseEnter={() => setHoveredCommentId(item.id)}
            onMouseLeave={() => setHoveredCommentId(null)}
          >
            <div className={`flex items-start p-2 rounded `}>
              {/* 아바타 */}
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                <span className="text-sm font-medium text-blue-600">
                  {initials}
                </span>
              </div>
              {/* 피드백 내용 카드 */}
              <div className="bg-slate-50 rounded-lg p-4 flex-grow">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-800">
                    {isAiFeedback ? "AI피드백" : username}
                  </span>
                  {timestamp && (
                    <span className="text-xs text-gray-500">{timestamp}</span>
                  )}
                </div>
                <p className="text-gray-700">
                  {contentWithoutPrefix || "No feedback available"}
                </p>
                <div className="flex items-center mt-2 space-x-2">
                  <button
                    className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                    onClick={() => editFeedbackPoint(item)}
                  >
                    수정
                  </button>
                  <button
                    className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                    onClick={() => deleteFeedbackPoint(item.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default CommentList;
