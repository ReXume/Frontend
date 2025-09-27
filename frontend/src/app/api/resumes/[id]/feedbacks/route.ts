import { NextResponse } from "next/server";

// GET /api/resumes/[id]/feedbacks
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const resumeId = Number(resolvedParams.id);
  if (!resumeId || Number.isNaN(resumeId)) {
    return NextResponse.json({ message: "Invalid resume id" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const dummy = [
    {
      id: 101,
      content: "헤더 가독성을 위해 여백을 늘려보세요.",
      xCoordinate: 120,
      yCoordinate: 180,
      pageNumber: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 102,
      content: "경력 기술은 STAR 방식으로 보완하면 좋아요.",
      xCoordinate: 240,
      yCoordinate: 360,
      pageNumber: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 103,
      content: "프로젝트 성과에 수치를 추가해 주세요 (예: 20% 개선).",
      xCoordinate: 300,
      yCoordinate: 520,
      pageNumber: 2,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return NextResponse.json(dummy, { status: 200 });
}

// POST /api/resumes/[id]/feedbacks
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const resumeId = Number(resolvedParams.id);
  if (!resumeId || Number.isNaN(resumeId)) {
    return NextResponse.json({ message: "Invalid resume id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { content, xCoordinate, yCoordinate, pageNumber = 1 } = body ?? {};
  if (
    typeof content !== "string" ||
    typeof xCoordinate !== "number" ||
    typeof yCoordinate !== "number"
  ) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const created = {
    id: Math.floor(Math.random() * 100000),
    content,
    xCoordinate,
    yCoordinate,
    pageNumber,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json(created, { status: 201 });
}


