import { axiosInstance } from "./axios.config.ts";
import { AddFeedbackPoint, FeedbackPoint, ResumeData } from "../types.ts";

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
  const response = await axiosInstance.post(
    `/resumes/${resumeId}/feedbacks`,
    feedbackData
  );
  return response.data;
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
  const response = await axiosInstance.delete(
    `/resumes/${resumeId}/feedbacks/${feedbackId}`
  );
  return response.data;
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
  const response = await axiosInstance.put(
    `/resumes/${resumeId}/feedbacks/${feedbackId}`,
    feedbackData
  );
  return response.data;
};

/**
 * 이력서 데이터 조회 API
 * @param resumeId - 이력서 ID
 * @returns Resume 데이터
 */
export const getResumeApi = async (resumeId: number): Promise<ResumeData> => {
  const response = await axiosInstance.get(`/resumes/${resumeId}`);
  return response.data.result;
};

/**
 * AI 피드백 요청 API
 * @param resumeId - 이력서 ID
 * @returns AI 피드백 데이터
 */
export const postAiFeedback = async (resumeId: number) => {
  const response = await axiosInstance.post(`/aifeedbacks/${resumeId}`, {});
  return response.data;
};
