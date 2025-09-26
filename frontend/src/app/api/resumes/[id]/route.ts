import { NextResponse } from "next/server";

// Mock Resume detail
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!id || Number.isNaN(id)) {
    return NextResponse.json({ message: "Invalid resume id" }, { status: 400 });
  }

  const mock = {
    result: {
      resumeId: id,
      userName: "홍길동",
      position: "Frontend Engineer",
      career: 3,
      techStackNames: ["React", "TypeScript", "Next.js"],
      fileUrl: "/sample.pdf",
      feedbackResponses: [
        {
          id: 101,
          content: "헤더 가독성을 위해 여백을 늘려보세요.",
          xCoordinate: 120,
          yCoordinate: 180,
          pageNumber: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 102,
          content: "경력 기술은 STAR 방식으로 보완하면 좋아요.",
          xCoordinate: 240,
          yCoordinate: 360,
          pageNumber: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 103,
          content: "프로젝트 성과에 수치를 추가해 주세요 (예: 20% 개선).",
          xCoordinate: 300,
          yCoordinate: 520,
          pageNumber: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      previousResumeId: null,
      laterResumeId: null,
    },
  };

  return NextResponse.json(mock, { status: 200 });
}


