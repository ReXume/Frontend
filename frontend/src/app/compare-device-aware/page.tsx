"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import ResumeLayout from "@/components/layout/ResumeLayout";
import { FeedbackPoint } from "@/types/FeedbackPointType";
import { renderSchedulerDeviceAware } from "@/libs/renderSchedulerDeviceAware";
import PDFViewer from "@/components/resumeoverview_old/pdfDeviceAware/PDFViewer";
import ResumeOverview from "@/components/feedback/ResumeOverview";
import CommentSection from "@/components/comment_old/CommentSection";

export default function CompareDeviceAwarePage() {
  const [feedbackPoints] = useState<FeedbackPoint[]>([]);
  const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
  const [clickedCommentId, setClickedCommentId] = useState<number | null>(null);

  // 기기 설정 정보 (클라이언트 사이드에서만 업데이트)
  const [tier, setTier] = useState<string>('medium');
  const [config, setConfig] = useState({
    concurrency: 3,
    ioDebounceMs: 100,
    viewportMarginVh: 35,
    description: '기기 감지 중...'
  });

  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window !== 'undefined') {
      // 벤치마크에서 접근할 수 있도록 window에 노출
      (window as any).renderSchedulerDeviceAware = renderSchedulerDeviceAware;
      
      setTier(renderSchedulerDeviceAware.getDeviceTier());
      setConfig(renderSchedulerDeviceAware.getConfig());
    }
  }, []);

  const addFeedbackPoint = (point: any) => {
    console.log("피드백 포인트 추가:", point);
  };

  const editFeedbackPoint = (point: FeedbackPoint) => {
    console.log("피드백 포인트 수정:", point);
  };

  return (
    <div className="flex flex-col flex-grow bg-[#F9FAFB]">
      <Navbar />
      
      {/* 디버그 정보 (우측 하단 고정, 호버 시 상세 표시) */}
      <div className="fixed bottom-5 right-5 p-3 bg-gray-900 text-white rounded-lg shadow-lg group cursor-pointer hover:bg-gray-800 transition-all z-50 max-w-sm">
        <div className="text-xs font-mono">
          <div className="font-bold mb-2">🎯 Device-Aware</div>
          <div className="group-hover:hidden">
            티어: {tier.toUpperCase()} · K: {config.concurrency}
          </div>
          <div className="hidden group-hover:block space-y-1">
            <div>티어: {tier.toUpperCase()}</div>
            <div>동시 렌더 상한 (K): {config.concurrency}</div>
            <div>IO 디바운스: {config.ioDebounceMs}ms</div>
            <div>Viewport Margin: {config.viewportMarginVh}vh</div>
            <div className="pt-2 mt-2 border-t border-gray-700 text-gray-400 text-[10px] leading-relaxed">
              {config.description}
            </div>
          </div>
        </div>
      </div>

      <ResumeLayout
        sidebar={
          <div className="flex flex-col justify-between bg-[#F9FAFB] p-2 mt-10">
            <ResumeOverview
              userName="테스트 사용자"
              position="프론트엔드"
              career={3}
              techStackNames={["React", "TypeScript", "Next.js"]}
              fileUrl="/sample4.pdf"
              isLoading={false}
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
        <div className="flex flex-col bg-[#F9FAFB] h-[90vh]">
          <div className="flex-grow mt-10 mb-6 px-6">
            <PDFViewer
              pdfSrc="/sample4.pdf"
              pageNumber={1}
              addFeedbackPoint={addFeedbackPoint}
              editFeedbackPoint={editFeedbackPoint}
              feedbackPoints={feedbackPoints}
              hoveredCommentId={hoveredCommentId}
              setHoveredCommentId={setHoveredCommentId}
              setClickedCommentId={setClickedCommentId}
            />
          </div>
        </div>
      </ResumeLayout>
    </div>
  );
}

