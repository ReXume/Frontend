"use client";

import ResumePageGroup from "./ResumePageGroup";
import Footer from "./Footer";
import { FeedbackPoint } from "@/types/FeedbackPointType";

type MainContainerProps = {
  feedbackPoints: FeedbackPoint[];
  // addFeedbackPoint: (point: Omit<AddFeedbackPoint, "id">) => void;
  // deleteFeedbackPoint: (id: number) => void;
  // editFeedbackPoint: (item: AddFeedbackPoint) => void;
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
  setClickedCommentId: (id: number | null) => void;
  // laterResumeId: number | null;
  // previousResumeId: number | null;
};

function MainContainer({
  feedbackPoints,
  // addFeedbackPoint,
  // deleteFeedbackPoint,
  // editFeedbackPoint,
  hoveredCommentId,
  setHoveredCommentId,
  setClickedCommentId,
  // laterResumeId,
  // previousResumeId,
}: MainContainerProps) {
  // console.log({ setClickedCommentId });

  return (
    <div className=" flex flex-col bg-[#F9FAFB] h-[90vh] ">
      {/* Scrollable Content with space for the fixed NavBar and Footer */}
      <div className="flex-grow mt-10 mb-6 px-6">
        {/* Adjusted margin */}
        <ResumePageGroup
          // pages={1} // Adjust 'pages' to the number of resume pages
          feedbackPoints={feedbackPoints}
          // addFeedbackPoint={addFeedbackPoint}
          // deleteFeedbackPoint={deleteFeedbackPoint}
          // editFeedbackPoint={editFeedbackPoint}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          setClickedCommentId={setClickedCommentId}
        />
      </div>
      <Footer
        // laterResumeId={laterResumeId}
        // previousResumeId={previousResumeId}
      />
    </div>
  );
}

export default MainContainer;
