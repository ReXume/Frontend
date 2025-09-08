import { jsonAxios } from "./axios.config.ts";
import * as Sentry from "@sentry/browser";

// 북마크 추가
export const postBookmark = async (resumeId: number) => {
  try {
    const response = await jsonAxios.post(`/bookmarks/${resumeId}`);
    return response.data.result;
  } catch (error) {
    console.error("북마크 추가 오류:", error);
    const customError = new Error("북마크 추가 오류");
    Sentry.captureException(customError);
    throw error;
  }
};

// 북마크 조회
export const getBookmarkById = async (userId: number) => {
  try {
    const response = await jsonAxios.get(`/bookmarks/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error("북마크 조회 오류:", error);
    const customError = new Error("북마크 조회 오류");
    Sentry.captureException(customError);
    throw error;
  }
};

// 북마크 삭제
export const deleteBookmarkById = async (bookmarkId: number) => {
  try {
    const response = await jsonAxios.delete(`/bookmarks/${bookmarkId}`);
    console.log("북마크 삭제 성공:", response.data);
    return response.data;
  } catch (error) {
    console.error("북마크 삭제 오류:", error);
    const customError = new Error("북마크 삭제 오류");
    Sentry.captureException(customError);
    throw error;
  }
};
