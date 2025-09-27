import { NextResponse } from "next/server";

// POST /api/aifeedbacks/[id]
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const resumeId = Number(resolvedParams.id);
  if (!resumeId || Number.isNaN(resumeId)) {
    return NextResponse.json({ message: "Invalid resume id" }, { status: 400 });
  }

  const feedbacks = [
    {
      id: 1,
      content: "섹션 제목은 일관된 스타일로 통일하는 것이 좋습니다.",
      xCoordinate: 120,
      yCoordinate: 240,
      pageNumber: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return NextResponse.json({ feedbacks }, { status: 200 });
}


