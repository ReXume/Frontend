import ResumePage from "./ResumePage";
import { AddFeedbackPoint, FeedbackPoint } from "../../types.ts";

type ResumePageGroupProps = {
  feedbackPoints: FeedbackPoint[];
  addFeedbackPoint: (point: Omit<AddFeedbackPoint, "id" | "type">) => void;
  deleteFeedbackPoint: (id: number) => void;
  editFeedbackPoint: (item: AddFeedbackPoint) => void;
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
  setClickedCommentId: (id: number | null) => void;
};

function ResumePageGroup({
  feedbackPoints,
  addFeedbackPoint,
  deleteFeedbackPoint,
  editFeedbackPoint,
  hoveredCommentId,
  setHoveredCommentId,
  setClickedCommentId,
}: ResumePageGroupProps) {
  // 단일 페이지만 렌더링
  return (
    <ResumePage
      key={1}
      pageNumber={1}
      feedbackPoints={feedbackPoints}
      addFeedbackPoint={addFeedbackPoint}
      deleteFeedbackPoint={deleteFeedbackPoint}
      editFeedbackPoint={editFeedbackPoint}
      hoveredCommentId={hoveredCommentId}
      setHoveredCommentId={setHoveredCommentId}
      setClickedCommentId={setClickedCommentId}
    />
  );
}

export default ResumePageGroup;
