"use client";

import ResumeLayout from "@/components/layout/ResumeLayout";
import useResumeStore from "@/store/ResumeStore";
import { FeedbackPoint } from "@/types/FeedbackPointType";
import { ResumeData } from "@/types/ResumeDataType";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkMinus } from "lucide-react";
import ResumeOverview from "@/components/feedback/ResumeOverview";
import { useBookmarkStore } from "@/store/BookmarkStore";
import CommentSection from "@/components/comment_old/CommentSection";
import MainContainer from "@/components/resumeoverview_old/MainContainer";
import { getResumeApi } from "@/api/feedbackApi";
import Navbar from "@/components/layout/Navbar";
import ErrorMessage from "@/components/UI_old/ErrorMessage";

export default function FeedbackPage() {
  const params = useParams();
  const id = (params as { id?: string })?.id;
  const resumeId = Number(id);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [feedbackPoints, setFeedbackPoints] = useState<FeedbackPoint[]>([]);
  const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
  const [, setClickedCommentId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { setResumeUrl } = useResumeStore();
  const { setBookmarks, isBookmarked } = useBookmarkStore();
  
  useEffect(() => {
    const fetchData = async () => {
      if (!resumeId) {
        setError("Resume ID is missing.");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await getResumeApi(resumeId);
        setResumeData(data);
        setFeedbackPoints(data.feedbackResponses || []);
        setResumeUrl(data.fileUrl);

        // const userId = 1; // 예시 사용자 ID
        // const bookmarksData = await getBookmarkById(userId);
        // setBookmarks(bookmarksData.result);
      } catch (e: unknown) {
        console.error(e);
        setError("Error fetching resume data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [resumeId, setResumeUrl, setBookmarks]);

  // const toggleBookmark = async () => {
  //   if (!resumeId) {
  //     setError("Resume ID is missing.");
  //     return;
  //   }
  //   try {
  //     // 현재 북마크 상태 확인
  //     const existingBookmark = bookmarks.find((bk) => bk.resume_id === resumeId);
      
  //     if (existingBookmark) {
  //       // 북마크 삭제
  //       await deleteBookmarkById(existingBookmark.bookmark_id);
  //       setBookmarks(
  //         bookmarks.filter((bk) => bk.bookmark_id !== existingBookmark.bookmark_id)
  //       );
  //       Swal.fire({
  //         icon: "success",
  //         title: "북마크가 해제되었습니다.",
  //         confirmButtonText: "확인",
  //       });
  //     } else {
  //       // 북마크 추가
  //       const newBookmarkResponse = await postBookmark(resumeId);
        
  //       // API 응답을 BookmarkType 형태로 변환 (임시 데이터와 함께)
  //       const newBookmark: BookmarkType = {
  //         id: newBookmarkResponse.bookmark_id,
  //         bookmark_id: newBookmarkResponse.bookmark_id,
  //         resume_id: newBookmarkResponse.resume_id,
  //         user_name: "현재 사용자", // 임시값 - 실제로는 사용자 정보에서 가져와야 함
  //         title: resumeData?.resume_title || "이력서", // 실제 이력서 제목 사용
  //         date: new Date().toISOString(),
  //         resume_title: resumeData?.resume_title || "이력서",
  //         resume_author: resumeData?.userName || "작성자",
  //         created_at: new Date().toISOString(),
  //         updated_at: new Date().toISOString(),
  //       };
        
  //       setBookmarks([...bookmarks, newBookmark]);
  //       Swal.fire({
  //         icon: "success",
  //         title: "북마크가 추가되었습니다.",
  //         confirmButtonText: "확인",
  //       });
  //     }
  //   } catch (error) {
  //     console.error("북마크 토글 오류:", error);
  //     Swal.fire({
  //       icon: "error",
  //       title: "북마크 상태를 변경할 수 없습니다. 다시 시도해주세요.",
  //       confirmButtonText: "확인",
  //     });
  //   }
  // };

  // const handleAiFeedback = async () => {
  //   setLoading(true);
  //   try {
  //     const aiFeedback = await postAiFeedback(resumeId);
  //     setFeedbackPoints((prev) => [...prev, ...aiFeedback.feedbacks]);
  //   } catch {
  //     setError("Failed to retrieve AI feedback.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const addFeedbackPoint = async (point: Omit<AddFeedbackPoint, "id">) => {
  //   try {
  //     if (
  //       !point.content ||
  //       point.xCoordinate === undefined ||
  //       point.yCoordinate === undefined
  //     ) {
  //       setError("모든 필드를 입력해주세요.");
  //       return;
  //     }
  //     setLoading(true);
  //     const newPoint: AddFeedbackPoint = { ...point, pageNumber: 1 };
  //     await addFeedbackApi(resumeId, newPoint);
  //     const updatedData = await getResumeApi(resumeId);
  //     setFeedbackPoints(updatedData.feedbackResponses);
  //   } catch {
  //     setError("피드백 추가에 실패했습니다. 나중에 다시 시도해주세요.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const deleteFeedbackPoint = async (feedbackId: number) => {
  //   try {
  //     setLoading(true);
  //     await deleteFeedbackApi(resumeId, feedbackId);
  //     setFeedbackPoints((prev) =>
  //       prev.filter((item) => item.id !== feedbackId)
  //     );
  //   } catch {
  //     setError("피드백 삭제에 실패했습니다. 나중에 다시 시도해주세요.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const editFeedbackPoint = (updatedItem: AddFeedbackPoint) => {
  //   console.log("Edit feedback point: ", updatedItem);
  // };

  // if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  // if (!resumeData) return <div>No resume data available.</div>;

  const bookmarked = isBookmarked(resumeId);

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
                // addFeedbackPoint={addFeedbackPoint}
                // deleteFeedbackPoint={deleteFeedbackPoint}
                // editFeedbackPoint={editFeedbackPoint}
                hoveredCommentId={hoveredCommentId}
                // handleAiFeedback={handleAiFeedback}
                setHoveredCommentId={setHoveredCommentId}
              />
            </div>
          </div>
        }
      >
        <MainContainer
          feedbackPoints={feedbackPoints}
          // addFeedbackPoint={addFeedbackPoints}
          // deleteFeedbackPoint={deleteFeedbackPoint}
          // editFeedbackPoint={editFeedbackPoint}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          // laterResumeId={resumeData.laterResumeId}
          // previousResumeId={resumeData.previousResumeId}
          setClickedCommentId={setClickedCommentId}
        />
      </ResumeLayout>
    </div>
  );
}
