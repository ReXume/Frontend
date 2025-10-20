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
  
  // 페이지마다 여러 피드백을 생성하여 렌더링 부하 테스트
  const feedbackTemplates = [
    "헤더 가독성을 위해 여백을 늘려보세요.",
    "경력 기술은 STAR 방식으로 보완하면 좋아요.",
    "프로젝트 성과에 수치를 추가해 주세요 (예: 20% 개선).",
    "글꼴 크기가 너무 작아요. 11pt 이상 추천합니다.",
    "이 섹션의 간격이 불균형합니다.",
    "핵심 키워드를 굵게 표시하면 더 눈에 띕니다.",
    "동사로 문장을 시작하면 더 임팩트 있어요.",
    "이력서 상단에 핵심 역량을 요약하세요.",
    "기술 스택을 명확히 분류해 주세요.",
    "프로젝트 기간을 명시하면 좋습니다.",
  ];
  
  const dummy = [];
  let feedbackId = 101;
  
  // 페이지 1-100까지, 각 페이지마다 2개의 피드백 생성
  for (let page = 1; page <= 100; page++) {
    for (let i = 0; i < 2; i++) {
      const x1 = 15 + (i * 40); // 피드백 시작 위치 (왼쪽, 오른쪽)
      const y1 = 10 + (i * 40);  // 피드백 시작 위치 (상단, 하단)
      
      dummy.push({
        id: feedbackId++,
        content: feedbackTemplates[(feedbackId - 101) % feedbackTemplates.length],
        x1: x1,
        x2: x1 + 20, // 너비 20%
        y1: y1,
        y2: y1 + 15, // 높이 15%
        pageNumber: page,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  
  console.log(`[Feedback API] 총 ${dummy.length}개의 피드백 생성 (페이지 1-100, 각 페이지당 2개)`);

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
  const { content, x1, x2, y1, y2, pageNumber = 1 } = body ?? {};
  if (
    typeof content !== "string" ||
    typeof x1 !== "number" ||
    typeof x2 !== "number" ||
    typeof y1 !== "number" ||
    typeof y2 !== "number"
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
    x1,
    x2,
    y1,
    y2,
    pageNumber,
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json(created, { status: 201 });
}


