import { FeedbackPoint } from "./FeedbackPointType";

export type ResumeData = {
  resumeId: number;
  userName: string;
  position: string;
  career: number;
  techStackNames: string[];
  fileUrl: string;
  feedbackResponses: FeedbackPoint[];
  previousResumeId: number | null;
  laterResumeId: number | null;
};
