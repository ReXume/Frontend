import Navbar from "@/components/layout/Navbar";
import ResumeLayout from "@/components/layout/ResumeLayout";
import ResumeOverview from "@/components/feedback/ResumeOverview";
import CommentSection from "@/components/comment_old/CommentSection";
import { cookies } from "next/headers";

import type { ResumeData } from "@/types/ResumeDataType";
import type { FeedbackPoint } from "@/types/FeedbackPointType";
import MainContainerSSR from "@/components/resumeoverview_old/MainContainerSSR"; // 클라 래퍼

type PageProps = { params: { id: string } };

export default async function FeedbackPage({ params }: PageProps) {
  const { id } = await params;          // ✅ 먼저 await
  const resumeId = Number(id);
  if (!resumeId || Number.isNaN(resumeId)) return <div>Invalid id</div>;

  const cookieHeader = (await cookies()).toString();

  const [resumeRes] = await Promise.all([
    fetch(`http://localhost:3000/api/resumes/${resumeId}`, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
    }),
  ]);
  if (!resumeRes.ok) return <div>Failed to load resume ({resumeRes.status})</div>;

  const resumeJson = await resumeRes.json();
  const initialResumeData: ResumeData = resumeJson.result as ResumeData;
  const initialFeedbackPoints: FeedbackPoint[] =
    (resumeJson.result?.feedbackResponses as FeedbackPoint[]) ?? [];

  return (
    <div className="flex flex-col flex-grow bg-[#F9FAFB]">
      <Navbar />
      <ResumeLayout
        sidebar={
          <SidebarSSRPart
            resumeData={initialResumeData}
            feedbackPoints={initialFeedbackPoints}
          />
        }
      >
        <MainContainerSSR feedbackPoints={initialFeedbackPoints} />
      </ResumeLayout>
    </div>
  );
}

function SidebarSSRPart({
  resumeData,
  feedbackPoints,
}: {
  resumeData: ResumeData;
  feedbackPoints: FeedbackPoint[];
}) {
  return (
    <div className="flex flex-col justify-between bg-[#F9FAFB] p-2 mt-10">
      <button className="flex items-center px-6 py-3 rounded-lg text-gray-500 hover:bg-gray-50">
        북마크 추가/제거
      </button>

      <ResumeOverview
        userName={resumeData.userName}
        position={resumeData.position}
        career={resumeData.career}
        techStackNames={resumeData.techStackNames}
        fileUrl={resumeData.fileUrl}
        isLoading={false}
      />

      <div className="overflow-y-auto mt-2">
        <CommentSection
          feedbackPoints={feedbackPoints}
          hoveredCommentId={null}
          // setHoveredCommentId={() => {}}
        />
      </div>
    </div>
  );
}
