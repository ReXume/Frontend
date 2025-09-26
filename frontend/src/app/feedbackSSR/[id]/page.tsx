import FeedbackView from "./FeedbackView";
import { cookies } from "next/headers";

export default async function FeedbackPage({
  params,
}: {
  params: { id: string };
}) {
  const resumeId = Number(params.id);
  if (!resumeId || Number.isNaN(resumeId)) {
    return null;
  }
  const [resumeRes, bookmarksRes] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/resumes/${resumeId}`, {
      cache: "no-store",
      headers: { cookie: (await cookies()).toString() },
    }),
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/bookmarks/users/1`, {
      cache: "no-store",
      headers: { cookie: (await cookies()).toString() },
    }),
  ]);

  const resumeJson = await resumeRes.json();
  const bookmarksJson = await bookmarksRes.json();

  const initialResumeData = resumeJson.result;
  const initialFeedbackPoints = resumeJson.result?.feedbackResponses ?? [];
  const initialBookmarks = bookmarksJson.result ?? [];

  return (
    <FeedbackView
      resumeId={resumeId}
      initialResumeData={initialResumeData}
      initialFeedbackPoints={initialFeedbackPoints}
      initialBookmarks={initialBookmarks}
    />
  );
}
