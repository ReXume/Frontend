import { NextResponse } from "next/server";

// GET /api/resumes/[id]/feedbacks/[feedbackId]
export async function GET(
  _req: Request,
  { params }: { params: { id: string; feedbackId: string } }
) {
  const resumeId = Number(params.id);
  const feedbackId = Number(params.feedbackId);
  if (!resumeId || Number.isNaN(resumeId) || !feedbackId || Number.isNaN(feedbackId)) {
    return NextResponse.json({ message: "Invalid ids" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const dummy = {
    id: feedbackId,
    content: "문장 길이가 길어 가독성이 떨어집니다. 두 문장으로 분리해요.",
    xCoordinate: 200,
    yCoordinate: 300,
    pageNumber: 1,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json(dummy, { status: 200 });
}

// PUT /api/resumes/[id]/feedbacks/[feedbackId]
export async function PUT(
  req: Request,
  { params }: { params: { id: string; feedbackId: string } }
) {
  const resumeId = Number(params.id);
  const feedbackId = Number(params.feedbackId);
  if (!resumeId || Number.isNaN(resumeId) || !feedbackId || Number.isNaN(feedbackId)) {
    return NextResponse.json({ message: "Invalid ids" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { content, xCoordinate, yCoordinate, pageNumber = 1 } = body ?? {};
  if (
    typeof content !== "string" ||
    typeof xCoordinate !== "number" ||
    typeof yCoordinate !== "number"
  ) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const updated = {
    id: feedbackId,
    content,
    xCoordinate,
    yCoordinate,
    pageNumber,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json(updated, { status: 200 });
}

// DELETE /api/resumes/[id]/feedbacks/[feedbackId]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; feedbackId: string } }
) {
  const resumeId = Number(params.id);
  const feedbackId = Number(params.feedbackId);
  if (!resumeId || Number.isNaN(resumeId) || !feedbackId || Number.isNaN(feedbackId)) {
    return NextResponse.json({ message: "Invalid ids" }, { status: 400 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}


