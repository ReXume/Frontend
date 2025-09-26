import { AddFeedbackPoint } from "../types/AddFeedbackPointType";
import { FeedbackPoint } from "../types/FeedbackPointType";
import { ResumeData } from "../types/ResumeDataType";

const BASE_URL = "/api";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${input}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * 피드백 등록 API
 * @param resumeId - 이력서 ID
 * @param feedbackData - 피드백 데이터
 * @returns 등록된 피드백 데이터
 */
export const addFeedbackApi = async (
  resumeId: number,
  feedbackData: AddFeedbackPoint
): Promise<FeedbackPoint> => {
  console.log(feedbackData);
  return await fetchJson(`/resumes/${resumeId}/feedbacks`, {
    method: "POST",
    body: JSON.stringify(feedbackData),
  });
};

/**
 * 피드백 삭제 API
 * @param resumeId - 이력서 ID
 * @param feedbackId - 피드백 ID
 * @returns 삭제 결과 데이터
 */
export const deleteFeedbackApi = async (
  resumeId: number,
  feedbackId: number
) => {
  return await fetchJson(`/resumes/${resumeId}/feedbacks/${feedbackId}`, {
    method: "DELETE",
  });
};

/**
 * 피드백 수정 API
 * @param resumeId - 이력서 ID
 * @param feedbackId - 피드백 ID
 * @param feedbackData - 수정할 피드백 데이터
 * @returns 수정된 피드백 데이터
 */
export const editFeedbackApi = async (
  resumeId: number,
  feedbackId: number,
  feedbackData: {
    content: string;
    xCoordinate: number;
    yCoordinate: number;
  }
): Promise<FeedbackPoint> => {
  return await fetchJson(`/resumes/${resumeId}/feedbacks/${feedbackId}`, {
    method: "PUT",
    body: JSON.stringify(feedbackData),
  });
};

/**
 * 이력서 데이터 조회 API
 * @param resumeId - 이력서 ID
 * @returns Resume 데이터
 */
export const getResumeApi = async (resumeId: number): Promise<ResumeData> => {
  const data = await fetchJson<{ result: ResumeData }>(`/resumes/${resumeId}`);
  return data.result;
};

/**
 * AI 피드백 요청 API
 * @param resumeId - 이력서 ID
 * @returns AI 피드백 데이터
 */
export const postAiFeedback = async (resumeId: number) => {
  return await fetchJson(`/aifeedbacks/${resumeId}`, { method: "POST", body: JSON.stringify({}) });
};
