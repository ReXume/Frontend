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
import { getResumeApi } from "@/api/feedbackApi";
import Navbar from "@/components/layout/Navbar";
import ErrorMessage from "@/components/UI_old/ErrorMessage";
import React, { useRef } from "react";
import dynamic from "next/dynamic";

// rAF 버전 PDFViewer 동적 import
const PDFViewerRAF = dynamic(() => import("@/components/resumeoverview_old/pdfRAF/PDFViewer"), {
  ssr: false,
  loading: () => <div>PDF 로딩 중... (rAF 버전)</div>,
});

// rAF 전용 ResumePage 컴포넌트
function ResumePageRAF({
  pageNumber,
  feedbackPoints,
  hoveredCommentId,
  setHoveredCommentId,
  setClickedCommentId,
}: {
  pageNumber: number;
  feedbackPoints: FeedbackPoint[];
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
  setClickedCommentId: (id: number | null) => void;
}) {
  const pageRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100; // 백분율
    const y = ((e.clientY - rect.top) / rect.height) * 100; // 백분율

    console.log({ x, y, pageNumber });
  };

  const { ResumeUrl } = useResumeStore();

  return (
    <div className="relative mb-8">
      {/* rAF 버전 표시 */}
      <div className="mb-2 px-4 py-2 bg-orange-100 rounded-md text-sm text-gray-700 font-medium">
        <div>현재 버전: 🎬 PDF rAF (requestAnimationFrame)</div>
        <div className="text-xs text-gray-600 mt-1">requestAnimationFrame을 사용한 렌더링 최적화</div>
      </div>
      <div
        ref={pageRef}
        className="w-full h-[903px] items-center relative cursor-pointer -mt-1"
        onClick={handleClick}
      >
        <PDFViewerRAF
          pdfSrc={ResumeUrl}
          addFeedbackPoint={() => {}} // 임시 함수
          editFeedbackPoint={() => {}} // 임시 함수
          feedbackPoints={feedbackPoints}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          setClickedCommentId={setClickedCommentId}
        />
      </div>
    </div>
  );
}

// rAF 전용 MainContainer
function MainContainerRAF({
  feedbackPoints,
  hoveredCommentId,
  setHoveredCommentId,
  setClickedCommentId,
}: {
  feedbackPoints: FeedbackPoint[];
  hoveredCommentId: number | null;
  setHoveredCommentId: (id: number | null) => void;
  setClickedCommentId: (id: number | null) => void;
}) {
  return (
    <div className=" flex flex-col bg-[#F9FAFB] h-[90vh] ">
      <div className="flex-grow mt-10 mb-6 px-6">
        <ResumePageRAF
          pageNumber={1}
          feedbackPoints={feedbackPoints}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          setClickedCommentId={setClickedCommentId}
        />
      </div>
    </div>
  );
}

export default function FeedbackRAFPage() {
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

  const bookmarked = isBookmarked(resumeId);

  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="flex flex-col flex-grow bg-[#F9FAFB]">
      <Navbar />
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
        <MainContainerRAF
          feedbackPoints={feedbackPoints}
          hoveredCommentId={hoveredCommentId}
          setHoveredCommentId={setHoveredCommentId}
          setClickedCommentId={setClickedCommentId}
        />
      </ResumeLayout>
    </div>
  );
}
