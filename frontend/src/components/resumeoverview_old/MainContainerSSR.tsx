// src/components/resumeoverview_old/MainContainerSSR.tsx
"use client";

import { useState } from "react";
import type { FeedbackPoint } from "@/types/FeedbackPointType";
import dynamic from "next/dynamic";

// pdf.js가 들어가는 실제 본문(예: MainContainer 또는 PDFViewer 포함 컴포넌트)
const MainContainer = dynamic(() => import("./MainContainer"), { ssr: false });

export default function MainContainerSSR({
  feedbackPoints,
}: {
  feedbackPoints: FeedbackPoint[];
}) {
  const [hoveredCommentId, setHoveredCommentId] = useState<number | null>(null);
  const [clickedCommentId, setClickedCommentId] = useState<number | null>(null);

  return (
    <MainContainer
      feedbackPoints={feedbackPoints}
      hoveredCommentId={hoveredCommentId}
      setHoveredCommentId={setHoveredCommentId}
      setClickedCommentId={setClickedCommentId}
    />
  );
}
