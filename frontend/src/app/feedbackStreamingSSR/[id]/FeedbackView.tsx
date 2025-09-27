"use client";
import ResumeLayout from "@/components/layout/ResumeLayout";
import { FeedbackPoint } from "@/types/FeedbackPointType";
import { ResumeData } from "@/types/ResumeDataType";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkMinus } from "lucide-react";
import ResumeOverview from "@/components/feedback/ResumeOverview";
import CommentSection from "@/components/comment_old/CommentSection";
import MainContainer from "@/components/resumeoverview_old/MainContainer";
import Navbar from "@/components/layout/Navbar";
import useResumeStore from "@/store/ResumeStore";

type Props = {
  resumeId: number;
  initialResumeData: ResumeData;
  initialFeedbackPoints: FeedbackPoint[];
};

export default function FeedbackView({
  resumeId,
  initialResumeData,
  initialFeedbackPoints,
}: Props) {
  const [resumeData] = useState<ResumeData | null>(
    initialResumeData
  );
  const [feedbackPoints] = useState<FeedbackPoint[]>(
    initialFeedbackPoints ?? []
  );
  const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
  const [loading] = useState<boolean>(false);
  // const [, setError] = useState<string | null>(null);
  const [, setClickedCommentId] = useState<number | null>(null);
  const { setResumeUrl } = useResumeStore();
  const [ bookmarked ] = useState<boolean>(true);


  // const { bookmarks, setBookmarks, isBookmarked } = useBookmarkStore();

  useEffect(() => {
    setResumeUrl(initialResumeData.fileUrl);
  }, [initialResumeData.fileUrl, setResumeUrl]);

  // const toggleBookmark = async () => {
  //   if (!resumeId) {
  //     setError("Resume ID is missing.");
  //     return;
  //   }
  //   try {
  //     const existingBookmark = bookmarks.find(
  //       (bk) => bk.bookmarks.some((b) => b.resume_id === resumeId)
  //     );
  //     if (existingBookmark) {
  //       await deleteBookmarkById(existingBookmark.bookmarks[0].bookmark_id);
  //       setBookmarks(
  //         bookmarks.filter(
  //           (bk) => bk.bookmarks[0].bookmark_id !== existingBookmark.bookmarks[0].bookmark_id
  //         )
  //       );
  //       Swal.fire({
  //         icon: "success",
  //         title: "북마크가 해제되었습니다.",
  //         confirmButtonText: "확인",
  //       });
  //     } else {
  //       const newBookmark = await postBookmark(resumeId);
  //       setBookmarks([
  //         ...bookmarks,
  //         ...(Array.isArray(newBookmark) ? newBookmark : [newBookmark]),
  //       ]);                
  //       Swal.fire({
  //         icon: "success",
  //         title: "북마크가 추가되었습니다.",
  //         confirmButtonText: "확인",
  //       });
  //     }
  //   } catch {
  //     Swal.fire({
  //       icon: "error",
  //       title: "북마크 상태를 변경할 수 없습니다. 다시 시도해주세요.",
  //       confirmButtonText: "확인",
  //     });
  //   }
  // };

  // const bookmarked = isBookmarked(resumeId);
  useEffect(() => {
    console.log({ resumeId });
  }, [resumeId]);

  return (
    <div className="flex flex-col flex-grow bg-[#F9FAFB]">
      <Navbar />
      <ResumeLayout
        sidebar={
          <div className="flex flex-col justify-between bg-[#F9FAFB] p-2 mt-10">
            <button
              // onClick={toggleBookmark}
              className={`flex items-center px-6 py-3 rounded-lg ${
                bookmarked
                  ? "bg-yellow-100 text-yellow-900"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {bookmarked ? (
                <>
                  <BookmarkMinus className="w-5 h-5 mr-2" />
                  북마크 제거
                </>
              ) : (
                <>
                  <Bookmark className="w-5 h-5 mr-2" />
                  북마크 추가
                </>
              )}
            </button>
            <ResumeOverview
              userName={resumeData?.userName}
              position={resumeData?.position}
              career={resumeData?.career}
              techStackNames={resumeData?.techStackNames}
              fileUrl={resumeData?.fileUrl}
              isLoading={loading}
            />
            <div className="overflow-y-auto mt-2">
              <CommentSection
                feedbackPoints={feedbackPoints}
                hoveredCommentId={hoveredCommentId}
                setHoveredCommentId={setHoveredCommentId}
              />
            </div>
          </div>
        }
      >
        <MainContainer
          feedbackPoints={feedbackPoints}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          setClickedCommentId={setClickedCommentId}
        />
      </ResumeLayout>
    </div>
  );
}


