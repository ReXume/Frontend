import FeedbackView from "./FeedbackView";
import { cookies } from "next/headers";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const resumeId = Number(resolvedParams.id);
  if (!resumeId || Number.isNaN(resumeId)) {
    return null;
  }
  const [resumeRes] = await Promise.all([
    fetch(`http://localhost:3000/api/resumes/${resumeId}`, {
      cache: "no-store",
      headers: { cookie: (await cookies()).toString() },
    }),
    fetch(`http://localhost:3000/api/bookmarks/users/1`, {
      cache: "no-store",
      headers: { cookie: (await cookies()).toString() },
    }),
  ]);

  const resumeJson = await resumeRes.json();
  // const bookmarksJson = await bookmarksRes.json();

  const initialResumeData = resumeJson.result;
  const initialFeedbackPoints = resumeJson.result?.feedbackResponses ?? [];
  // const initialBookmarks = bookmarksJson.result ?? [];

  return (
    <FeedbackView
      resumeId={resumeId}
      initialResumeData={initialResumeData}
      initialFeedbackPoints={initialFeedbackPoints}
    />
  );
}
