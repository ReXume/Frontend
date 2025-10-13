"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkMinus } from "lucide-react";
import ResumeLayout from "@/components/layout/ResumeLayout";
import ResumeOverview from "@/components/feedback/ResumeOverview";
import CommentSection from "@/components/comment_old/CommentSection";
import Navbar from "@/components/layout/Navbar";
import ErrorMessage from "@/components/UI_old/ErrorMessage";
import { useBookmarkStore } from "@/store/BookmarkStore";
import useResumeStore from "@/store/ResumeStore";
import { getResumeApi } from "@/api/feedbackApi";
import { FeedbackPoint } from "@/types/FeedbackPointType";
import { ResumeData } from "@/types/ResumeDataType";
import PDFViewer from "@/components/resumeoverview_old/pdfOld/PDFViewer";

export default function FeedbackBasicPage() {
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
      } catch (e: unknown) {
        console.error(e);
        setError("Error fetching resume data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [resumeId, setResumeUrl, setBookmarks]);

  const addFeedbackPoint = (point: {
    pageNumber: number;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    content: string;
  }) => {
    const newPoint: FeedbackPoint = {
      id: Date.now(), // 임시 ID
      pageNumber: point.pageNumber,
      x1: point.x1,
      x2: point.x2,
      y1: point.y1,
      y2: point.y2,
      content: point.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setFeedbackPoints((prev) => [...prev, newPoint]);
  };

  const editFeedbackPoint = (updatedItem: FeedbackPoint) => {
    setFeedbackPoints((prev) =>
      prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
    );
  };

  if (error) return <ErrorMessage message={error} />;

  const bookmarked = isBookmarked(resumeId);

  return (
    <div className="flex flex-col flex-grow bg-[#F9FAFB]">
      <Navbar />
      <div className="flex items-center justify-center py-4 bg-blue-50 border-b border-blue-200">
        <span className="text-blue-800 font-semibold">
          📄 기본 PDF 뷰어 (개선 전 버전)
        </span>
      </div>
      <ResumeLayout
        sidebar={
          <div className="flex flex-col justify-between bg-[#F9FAFB] p-2 mt-10">
            <button
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
              />
            </div>
          </div>
        }
      >
        <div className="flex items-center justify-center p-8">
          {resumeData?.fileUrl ? (
            <PDFViewer
              pdfSrc={resumeData.fileUrl}
              pageNumber={1}
              addFeedbackPoint={addFeedbackPoint}
              editFeedbackPoint={editFeedbackPoint}
              feedbackPoints={feedbackPoints}
              hoveredCommentId={hoveredCommentId}
              setHoveredCommentId={setHoveredCommentId}
              setClickedCommentId={setClickedCommentId}
            />
          ) : (
            <div className="text-gray-500">PDF를 불러오는 중...</div>
          )}
        </div>
      </ResumeLayout>
    </div>
  );
}

