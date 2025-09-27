import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const resolvedParams = await params;
  const userId = Number(resolvedParams.userId);
  if (!userId || Number.isNaN(userId)) {
    return NextResponse.json({ message: "Invalid user id" }, { status: 400 });
  }

  const mock = {
    result: [
      {
        bookmark_id: 1,
        created_at: new Date().toISOString(),
        resume_author: "홍길동",
        resume_id: 101,
        resume_title: "프론트엔드 개발자 이력서",
      },
    ],
  };

  return NextResponse.json(mock, { status: 200 });
}


