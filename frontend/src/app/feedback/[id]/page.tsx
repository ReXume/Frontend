import ResumeLayout from "@/components/layout/ResumeLayout";
import useResumeStore from "@/store/ResumeStore";
import { FeedbackPoint } from "@/types/FeedbackPointType";
import { ResumeData } from "@/types/ResumeDataType";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkMinus } from "lucide-react";
import ResumeOverview from "@/components/feedback/ResumeOverview";

export default function FeedbackPage() {
  const router = useRouter();
  const { id } = router.query;
  const resumeId = Number(id);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [feedbackPoints, setFeedbackPoints] = useState<FeedbackPoint[]>([]);
  const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { setResumeUrl } = useResumeStore();
  // const { bookmarks, setBookmarks, isBookmarked } = useBookmarkStore();

  // useEffect(() => {
  //   if (!router.isReady) return; // 라우터 준비 전에는 실행하지 않음
  //   const fetchData = async () => {
  //     if (!resumeId) {
  //       setError("Resume ID is missing.");
  //       return;
  //     }
  //     try {
  //       setLoading(true);
  //       setError(null);
  //       const data = await getResumeApi(resumeId);
  //       setResumeData(data);
  //       setFeedbackPoints(data.feedbackResponses || []);
  //       setResumeUrl(data.fileUrl);

  //       const userId = 1; // 예시 사용자 ID
  //       const bookmarksData = await getBookmarkById(userId);
  //       setBookmarks(bookmarksData.result || []);
  //     } catch (error) {
  //       console.error(error);
  //       setError("Error fetching resume data.");
  //     } finally {
  //       setLoading(false);
  //     }
  //   };
  //   fetchData();
  // }, [router.isReady, resumeId, setResumeUrl, setBookmarks]);

  // const toggleBookmark = async () => {
  //   if (!resumeId) {
  //     setError("Resume ID is missing.");
  //     return;
  //   }
  //   try {
  //     const existingBookmark = bookmarks.find(
  //       (bk) => bk.resume_id === resumeId
  //     );
  //     if (existingBookmark) {
  //       await deleteBookmarkById(existingBookmark.bookmark_id);
  //       setBookmarks(
  //         bookmarks.filter(
  //           (bk) => bk.bookmark_id !== existingBookmark.bookmark_id
  //         )
  //       );
  //       Swal.fire({
  //         icon: "success",
  //         title: "북마크가 해제되었습니다.",
  //         confirmButtonText: "확인",
  //       });
  //     } else {
  //       const newBookmark = await postBookmark(resumeId);
  //       setBookmarks([...bookmarks, newBookmark]);
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
  // if (error) return <ErrorMessage message={error} />;
  // if (!resumeData) return <div>No resume data available.</div>;

  // const bookmarked = isBookmarked(resumeId);

  return (
    <div className="flex flex-col flex-grow bg-[#F9FAFB]">
      <ResumeLayout
        sidebar={
          <div className="flex flex-col justify-between bg-[#F9FAFB] p-2 mt-10">
            <button
              onClick={toggleBookmark}
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
              userName={resumeData.userName}
              position={resumeData.position}
              career={resumeData.career}
              techStackNames={resumeData.techStackNames}
              fileUrl={resumeData.fileUrl}
              isLoading={loading}
            />
            <div className="overflow-y-auto mt-2">
              <CommentSection
                feedbackPoints={feedbackPoints}
                addFeedbackPoint={addFeedbackPoint}
                deleteFeedbackPoint={deleteFeedbackPoint}
                editFeedbackPoint={editFeedbackPoint}
                hoveredCommentId={hoveredCommentId}
                handleAiFeedback={handleAiFeedback}
                setHoveredCommentId={setHoveredCommentId}
              />
            </div>
          </div>
        }
      >
        <MainContainer
          feedbackPoints={feedbackPoints}
          addFeedbackPoint={addFeedbackPoint}
          deleteFeedbackPoint={deleteFeedbackPoint}
          editFeedbackPoint={editFeedbackPoint}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          laterResumeId={resumeData.laterResumeId}
          previousResumeId={resumeData.previousResumeId}
        />
      </ResumeLayout>
    </div>
  );
}
