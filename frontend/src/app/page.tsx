import MainPageClient from "@/components/MainPageClient";
import { getResumeList } from "@/api/resumeApi";

export default async function Page() {
  let initialResumes: any[] = [];
  try {
    initialResumes = await getResumeList(0, 8);
  } catch (error) {
    console.error("Failed to fetch resumes on server. Using fallback data.", error);
    initialResumes = [
      {
        resume_id: 1,
        user_name: "홍길동",
        position: "Frontend",
        career: 2,
        view_count: 123,
        tech_stack_names: ["React", "TypeScript", "Next.js"],
      },
      {
        resume_id: 2,
        user_name: "김영희",
        position: "Backend",
        career: 4,
        view_count: 256,
        tech_stack_names: ["Java", "Spring", "MySQL"],
      },
      {
        resume_id: 3,
        user_name: "이철수",
        position: "Data Engineer",
        career: 3,
        view_count: 98,
        tech_stack_names: ["Python", "Airflow", "Snowflake"],
      },
      {
        resume_id: 4,
        user_name: "박민수",
        position: "Fullstack",
        career: 5,
        view_count: 310,
        tech_stack_names: ["Node.js", "React", "PostgreSQL"],
      },
    ];
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <MainPageClient initialResumes={initialResumes} />
    </div>
  );
}