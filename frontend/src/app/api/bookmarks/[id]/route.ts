import { NextResponse } from "next/server";

// POST /api/bookmarks/[resumeId]
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const resumeId = Number(resolvedParams.id);
  if (!resumeId || Number.isNaN(resumeId)) {
    return NextResponse.json({ message: "Invalid resume id" }, { status: 400 });
  }
  const created = {
    bookmark_id: Math.floor(Math.random() * 10000),
    resume_id: resumeId,
  };
  return NextResponse.json(created, { status: 201 });
}

// DELETE /api/bookmarks/[bookmarkId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const bookmarkId = Number(resolvedParams.id);
  if (!bookmarkId || Number.isNaN(bookmarkId)) {
    return NextResponse.json({ message: "Invalid bookmark id" }, { status: 400 });
  }
  return NextResponse.json({ success: true }, { status: 200 });
}


